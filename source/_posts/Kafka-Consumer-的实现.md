title: Kafka Consumer 的实现
date: 2017-11-12 15:16:54
tags: 分布式
---

___说明: kafka 版本号为 0.11.0___


##Consumer 拉取消息的实现
在 Kafka Consumer 正常消费时，观察其调用堆栈。

```shell
"pool-16-thread-7" #154 prio=5 os_prio=0 tid=0x00007ff581c8c000 nid=0x326d runnable [0x00007ff5468e7000]
   java.lang.Thread.State: RUNNABLE
        ...
        at org.apache.kafka.clients.NetworkClient.poll(NetworkClient.java:433)
        at org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient.poll(ConsumerNetworkClient.java:232)
        - locked <0x00000000c2e04f90> (a org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient)
        at org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient.poll(ConsumerNetworkClient.java:208)
        at org.apache.kafka.clients.consumer.KafkaConsumer.pollOnce(KafkaConsumer.java:1096)
        at org.apache.kafka.clients.consumer.KafkaConsumer.poll(KafkaConsumer.java:1043)
        at org.springframework.kafka.listener.KafkaMessageListenerContainer$ListenerConsumer.run(KafkaMessageListenerContainer.java:571)
        ...
```

对应的代码实现是 `org.apache.kafka.clients.consumer.KafkaConsumer#poll`，如下：
```java
@Override
    public ConsumerRecords<K, V> poll(long timeout) {
        ...
        try {
            ...
            // poll for new data until the timeout expires
            long start = time.milliseconds();
            long remaining = timeout;
            do {
                Map<TopicPartition, List<ConsumerRecord<K, V>>> records = pollOnce(remaining);
                
                if (fetcher.sendFetches() > 0 || client.hasPendingRequests())
                        client.pollNoWakeup();
                        
                if (this.interceptors == null)
                    return new ConsumerRecords<>(records);
                else
                    return this.interceptors.onConsume(new ConsumerRecords<>(records));
                        
                long elapsed = time.milliseconds() - start;
                remaining = timeout - elapsed;
            } while (remaining > 0);
            return ConsumerRecords.empty();
        } finally {
            release();
        }
    }
```

其中 `org.apache.kafka.clients.consumer.KafkaConsumer#pollOnce`的实现如下：
```java
private Map<TopicPartition, List<ConsumerRecord<K, V>>> pollOnce(long timeout) {
        ...
        // ConsumerCoordinator coordinator;
        coordinator.poll(time.milliseconds(), timeout);
        ...

        // if data is available already, return it immediately
        Map<TopicPartition, List<ConsumerRecord<K, V>>> records = fetcher.fetchedRecords();
        if (!records.isEmpty())
            return records;

        // send any new fetches (won't resend pending fetches)
        fetcher.sendFetches();
        ...
        return fetcher.fetchedRecords();
    }
```

所以可以看到 consumer 每次 poll 时是先从 fetcher 中 fetchedRecords 的，如果拿不到结果，就新发起一个 sendFetches 请求。

###Consumer 拉取消息的数量
在 `org.apache.kafka.clients.consumer.internals.Fetcher#fetchedRecords` 可以看到 `maxPollRecords`(max.poll.records 配置) 变量限制了每次 poll 的消息条数，不管 consumer 对应多少个 partition，从所有 partition 拉取到的消息条数总和不会超过 `maxPollRecords`。

在 `org.apache.kafka.clients.consumer.internals.Fetcher#sendFetches` 可以看到 `fetchSize`(max.partition.fetch.bytes 配置) 用于每次创建 FetchRequest 时的 `org.apache.kafka.common.requests.FetchRequest.PartitionData` 的参数设置。`fetchSize`限制了 consumer 每次从每个 partition 拉取的数据量。
不过，还是看代码中的 `ConsumerConfig#MAX_PARTITION_FETCH_BYTES_DOC` 说明吧：
> The maximum amount of data per-partition the server will return. Records are fetched in batches by the consumer. If the first record batch in the first non-empty partition of the fetch is larger than this limit, the batch will still be returned to ensure that the consumer can make progress. The maximum record batch size accepted by the broker is defined via `message.max.bytes` (broker config) or `max.message.bytes` (topic config). See " + FETCH_MAX_BYTES_CONFIG + " for limiting the consumer request size.

####poll 和 fetch 的关系
在满足max.partition.fetch.bytes限制的情况下，假如fetch到了100个record，放到本地缓存后，由于max.poll.records限制每次只能poll出15个record。那么KafkaConsumer就需要执行7次才能将这一次通过网络发起的fetch请求所fetch到的这100个record消费完毕。其中前6次是每次pool中15个record，最后一次是poll出10个record。

##Consumer 的心跳机制
在 `org.apache.kafka.clients.consumer.internals.AbstractCoordinat` 中启动 `HeartbeatThread` 线程来定时发送心跳和检查 consumer 的状态。
每个 Consumer 都有一个 ConsumerCoordinator(继承 AbstractCoordinator)，每个 ConsumerCoordinator 都启动一个 `HeartbeatThread` 线程来维护心跳，心跳信息存放在 `org.apache.kafka.clients.consumer.internals.Heartbeat`。

实现如下：
```java
@Override
public void run() {
        try {
                log.debug("Heartbeat thread for group {} started", groupId);
                while (true) {
                    synchronized (AbstractCoordinator.this) {
                        ...
                        client.pollNoWakeup();
                        long now = time.milliseconds();
                        
                        if (coordinatorUnknown()) {
                            ...
                        } else if (heartbeat.sessionTimeoutExpired(now)) {
                            // the session timeout has expired without seeing a successful heartbeat, so we should
                            // probably make sure the coordinator is still healthy.
                            coordinatorDead();
                        } else if (heartbeat.pollTimeoutExpired(now)) {
                            // the poll timeout has expired, which means that the foreground thread has stalled
                            // in between calls to poll(), so we explicitly leave the group.
                            maybeLeaveGroup();
                        } else if (!heartbeat.shouldHeartbeat(now)) {
                            // poll again after waiting for the retry backoff in case the heartbeat failed or the
                            // coordinator disconnected
                            AbstractCoordinator.this.wait(retryBackoffMs);
                        } else {
                            heartbeat.sentHeartbeat(now);
                            ...
                        }
                  } // end synchronized
              } // end while
          } //end try              
} // end run       
```

其中最重要的两个 timeout 函数：
```java
public boolean sessionTimeoutExpired(long now) {
    return now - Math.max(lastSessionReset, lastHeartbeatReceive) > sessionTimeout;
}

public boolean pollTimeoutExpired(long now) {
    return now - lastPoll > maxPollInterval;
}
```

###sessionTimeout
如果是 sessionTimeout 则 Mark the current coordinator as dead，此时  会将 consumer 踢掉，重新分配 partition 和 consumer 的对应关系。

在 Kafka Server 端，Consumer 的 Group 定义了五个状态：：
![Consumer Group State](/img/kafka_consumer_state_in_server.png)

<p>

###pollTimeout
如果是 pollTimeout 则 Reset the generation and memberId because we have fallen out of the group，此时 consumer 会退出 group，当再次 poll 时又会 rejoin group 触发 rebalance group。

####Rebalance Generation 
表示 rebalance 之后的一届成员，主要是用于保护 consumer group，隔离无效 offset 提交。每次 group 进行 rebalance 之后，generation 号都会加 1，表示 group 进入到了一个新的版本，下图所示为 consumer 2 退出后 consumer 4 加入时 Rebalance Generation 的过程：
![Rebalance Generation](/img/Kafka_Rebalance_Generation.png)


##partition 的数量设置
- 一个 partition 只能被 Consumer Group 中的一个 consumer 消费，因此，为了提高并发量，可以提高 partition 的数量，但是这会造成 replica 副本拷贝的网络请求增加，故障恢复时的耗时增加。因为 kafka 使用 batch pull 的方式，所以单个线程的消费速率还是有保障的。并且 partition 数量过多，zk 维护 ISR 列表负载较重。

- partiton 数量最好是 consumer 数目的整数倍，比如取 24， consumer 数目的设置就会灵活很多。

- consumer 消费消息时不时严格有序的。当从多个 partition 读数据时，kafka 只保证在一个 partition 上数据是有序的，多个 partition 的消息消费很可能就不是严格有序的了。

##参数设置
###heartbeat.interval.ms
心跳间隔。心跳是在 consumer 与 coordinator 之间进行的。心跳是确定 consumer 存活，加入或者退出 group 的有效手段。
这个值必须设置的小于 session.timeout.ms，因为：
当 consumer 由于某种原因不能发 heartbeat 到 coordinator 时，并且时间超过 session.timeout.ms 时，就会认为该 consumer 已退出，它所订阅的 partition 会分配到同一 group 内的其它的 consumer 上。

####参数值
默认值：3000 (3s)，通常设置的值要低于session.timeout.ms的1/3。

<p>
###session.timeout.ms
consumer session 过期时间。如果超时时间范围内，没有收到消费者的心跳，broker 会把这个消费者置为失效，并触发消费者负载均衡。因为只有在调用 poll 方法时才会发送心跳，更大的 session 超时时间允许消费者在 poll 循环周期内处理消息内容，尽管这会有花费更长时间检测失效的代价。如果想控制消费者处理消息的时间，

####参数值
默认值：10000 (10s)，这个值必须设置在 broker configuration 中的 group.min.session.timeout.ms 与 group.max.session.timeout.ms 之间。

<p>

###max.poll.interval.ms
This config sets the maximum delay between client calls to poll(). 

When the timeout expires, the consumer will stop sending heartbeats and send an explicit LeaveGroup request. 

As soon as the consumer resumes processing with another call to poll(), the consumer will **rejoin the group**. 

By increasing the interval between expected polls, you can give the consumer more time to handle a batch of records returned frompoll(long). The drawback is that increasing this value may delay a group rebalance since the consumer will only join the rebalance inside the call to poll. You can use this setting to bound the time to finish a rebalance, but you risk slower progress if the consumer cannot actually call poll often enough.

参数设置大一点可以增加两次 poll 之间处理消息的时间。
当 consumer 一切正常(也就是保持着 heartbeat )，且参数的值小于消息处理的时长，会导致 consumer leave group 然后又 rejoin group，触发无谓的 group balance，出现 consumer livelock 现象。

但如果设置的太大，会延迟 group rebalance，因为消费者只会在调用 poll 时加入rebalance。

<p>

###max.poll.records
Use this setting to limit the total records returned from a single call to poll. This can make it easier to predict the maximum that must be handled within each poll interval. By tuning this value, you may be able to reduce the poll interval, which will reduce the impact of group rebalancing.

0.11.0 Kafka 的默认配置是 
- max.poll.interval.ms=5min
- max.poll.records=500

即平均 600ms 要处理完一条消息，如果消息的消费时间高于 600ms，则一定要调整 max.poll.records 或 max.poll.interval.ms。


##Kafka Javadoc - Detecting Consumer Failures
After subscribing to a set of topics, the consumer will automatically join the group when poll(long) is invoked. The poll API is designed to ensure consumer liveness. As long as you continue to call poll, the consumer will stay in the group and continue to receive messages from the partitions it was assigned. Underneath the covers, the consumer sends periodic heartbeats to the server. If the consumer crashes or is unable to send heartbeats for a duration of session.timeout.ms, then the consumer will be considered dead and its partitions will be reassigned.
It is also possible that the consumer could encounter a "livelock" situation where it is continuing to send heartbeats, but no progress is being made. To prevent the consumer from holding onto its partitions indefinitely in this case, we provide a liveness detection mechanism using the max.poll.interval.ms setting. Basically if you don't call poll at least as frequently as the configured max interval, then the client will proactively leave the group so that another consumer can take over its partitions. When this happens, you may see an offset commit failure (as indicated by a CommitFailedException thrown from a call to commitSync()). This is a safety mechanism which guarantees that only active members of the group are able to commit offsets. So to stay in the group, you must continue to call poll. 
  

##Reference
[Kafka消费组(consumer group)](http://www.cnblogs.com/huxi2b/p/6223228.html)
[kafka.apache.org javadoc](https://kafka.apache.org/0101/javadoc/index.html?org/apache/kafka/clients/consumer/KafkaConsumer.html)
[Coordinator实现原理](http://blog.leanote.com/post/zfb050/Coordinator%E5%AE%9E%E7%8E%B0%E5%8E%9F%E7%90%86)
[kafka params](http://debugo.com/kafka-params/)
[kafka源码分析之kafka的consumer的负载均衡管理](http://blog.csdn.net/u014393917/article/details/52043185)
[Group Management Protocol](http://www.cnblogs.com/devos/p/5656232.html)
[Kafka 之 Group 状态变化分析及 Rebalance 过程](http://matt33.com/2017/01/16/kafka-group/)
[KIP-62: Allow consumer to send heartbeats from a background thread](https://cwiki.apache.org/confluence/display/KAFKA/KIP-62%3A+Allow+consumer+to+send+heartbeats+from+a+background+thread)
[Kafka: The Definitive Guide Chapter 4 - Kafka Consumers](https://www.safaribooksonline.com/library/view/kafka-the-definitive/9781491936153/ch04.html)