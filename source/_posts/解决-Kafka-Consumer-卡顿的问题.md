title: 解决 Kafka Consumer 卡顿的问题
date: 2017-11-12 15:15:18
tags: 分布式
---

##运行环境说明
___kafka 版本号为 0.11.0___

Kafka Consumer 的参数配置如下：

```java
private Map<String, Object> getDefaultConsumerConfigs() {
        Map<String, Object> propsMap = new HashMap<>();

        // 手动设置自动提交为false,交由 spring-kafka 启动的invoker执行提交
        propsMap.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);

        propsMap.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, "30000");
        propsMap.put(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, "10000");
        propsMap.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        propsMap.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);

        // 从partition中获取消息最大大小
        propsMap.put(ConsumerConfig.MAX_PARTITION_FETCH_BYTES_CONFIG, "102400");
        
        return propsMap;
    }
```

##Consumer 卡顿现象
###Consumer 卡顿时的日志
每次卡顿不消费时都出现以下日志：
```shell
2017/11/09 19:35:29:DEBUG pool-16-thread-10 org.apache.kafka.clients.consumer.internals.Fetcher - Fetch READ_UNCOMMITTED at offset 11429299 for partition my_topic-27 returned fetch data (error=NONE, highWaterMark=11429299, lastStableOffset = -1, logStartOffset = 10299493, abortedTransactions = null, recordsSizeInBytes=0)
 2017/11/09 19:35:29:DEBUG pool-16-thread-10 org.apache.kafka.clients.consumer.internals.Fetcher - Added READ_UNCOMMITTED fetch request for partition my_topic-27 at offset 11429299 to node p-kafka-host-03.ali.keep:9092 (id: 6 rack: null)
 2017/11/09 19:35:29:DEBUG pool-16-thread-10 org.apache.kafka.clients.consumer.internals.Fetcher - Sending READ_UNCOMMITTED fetch for partitions [my_topic-27] to broker p-kafka-host-03.ali.keep:9092 (id: 6 rack: null)
 2017/11/09 19:35:29:DEBUG kafka-coordinator-heartbeat-thread | myConsumerGroup org.apache.kafka.clients.consumer.internals.AbstractCoordinator - Sending Heartbeat request for group myConsumerGroup to coordinator p-kafka-host-02:9092 (id: 2147483642 rack: null)
2017/11/09 19:35:29:DEBUG pool-16-thread-13 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - Attempt to heartbeat failed for group myConsumerGroup since it is rebalancing.
2017/11/09 19:35:29:INFO pool-16-thread-13 org.apache.kafka.clients.consumer.internals.ConsumerCoordinator - Revoking previously assigned partitions [my_topic-18] for group myConsumerGroup
2017/11/09 19:35:29:INFO pool-16-thread-13 org.springframework.kafka.listener.ConcurrentMessageListenerContainer - partitions revoked: [my_topic-18]
2017/11/09 19:35:29:INFO pool-16-thread-13 org.springframework.kafka.listener.ConcurrentMessageListenerContainer - partitions revoked: [my_topic-18]
2017/11/09 19:35:29:DEBUG pool-16-thread-4 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - Attempt to heartbeat failed for group myConsumerGroup since it is rebalancing.
2017/11/09 19:35:29:INFO pool-16-thread-4 org.apache.kafka.clients.consumer.internals.ConsumerCoordinator - Revoking previously assigned partitions [my_topic-21] for group myConsumerGroup
2017/11/09 19:35:29:INFO pool-16-thread-4 org.springframework.kafka.listener.ConcurrentMessageListenerContainer - partitions revoked: [my_topic-21]
2017/11/09 19:35:29:INFO pool-16-thread-4 org.springframework.kafka.listener.ConcurrentMessageListenerContainer - partitions revoked: [my_topic-21]

...

2017/11/09 19:35:29:DEBUG pool-16-thread-4 org.apache.kafka.clients.consumer.internals.Fetcher - Fetch READ_UNCOMMITTED at offset 11426689 for partition my_topic-21 returned fetch data (error=NONE, highWaterMark=11426689, lastStableOffset = -1, logStartOffset = 10552294, abortedTransactions = null, recordsSizeInBytes=0)
 2017/11/09 19:35:29:DEBUG pool-16-thread-13 org.apache.kafka.clients.consumer.internals.ConsumerCoordinator - Group myConsumerGroup committed offset 11429849 for partition my_topic-18
 2017/11/09 19:35:29:INFO pool-16-thread-13 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - (Re-)joining group myConsumerGroup
 2017/11/09 19:35:29:DEBUG pool-16-thread-13 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - Sending JoinGroup ((type: JoinGroupRequest, groupId=myConsumerGroup, sessionTimeout=30000, rebalanceTimeout=300000, memberId=p-my-consumer-host-03-12-97c12fb0-9bb7-4762-8478-538f06be9e90, protocolType=consumer, groupProtocols=org.apache.kafka.common.requests.JoinGroupRequest$ProtocolMetadata@54371fac)) to coordinator p-kafka-02.ali.keep:9092 (id: 2147483642 rack: null)
```

其中最重要的部分是：
> **2017/11/09 19:35:29:DEBUG pool-16-thread-13 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - Attempt to heartbeat failed for group myConsumerGroup since it is rebalancing.
2017/11/09 19:35:29:INFO pool-16-thread-13 org.apache.kafka.clients.consumer.internals.ConsumerCoordinator - Revoking previously assigned partitions [my_topic-18] for group myConsumerGroup
2017/11/09 19:35:29:INFO pool-16-thread-13 org.springframework.kafka.listener.ConcurrentMessageListenerContainer - partitions revoked: [my_topic-18]
...
2017/11/09 19:35:29:INFO pool-16-thread-13 org.apache.kafka.clients.consumer.internals.AbstractCoordinator - (Re-)joining group myConsumerGroup**

那为什么每次会这样呢？我们是有单独的线程在发起心跳的！!!


###Consumer 卡顿时的 jstack
观察日志可以发现，卡顿时 ConsumerCoordinator 在不停地 rejoin group，并且做 rebalance，所以需要对比在正常和卡顿这两种情况下 ConsumerCoordinator 的行为。

####正常时的 ConsumerCoordinator
```shell
cat jstack.normal.log | grep ConsumerCoordinator -B1 | grep -v ConsumerCoordinator | sort | uniq -c
32 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator$HeartbeatThread.run(AbstractCoordinator.java:931)
22 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator$HeartbeatThread.run(AbstractCoordinator.java:950)
```

####卡顿时的 ConsumerCoordinator
```shell
cat jstack.pause.log | grep ConsumerCoordinator -B1 | grep -v ConsumerCoordinator | sort | uniq -c
14 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator.ensureActiveGroup(AbstractCoordinator.java:316)
14 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator$HeartbeatThread.run(AbstractCoordinator.java:920)
8 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator$HeartbeatThread.run(AbstractCoordinator.java:931)
32 	at org.apache.kafka.clients.consumer.internals.AbstractCoordinator$HeartbeatThread.run(AbstractCoordinator.java:950)
```

根据以上的现场信息，可以发现关键就在 `AbstractCoordinator.ensureActiveGroup` 这一步，继续观察 jstack.pause.log 中的相关堆栈信息，如下：
```shell
"pool-16-thread-14" #167 prio=5 os_prio=0 tid=0x00007f5b19dbf000 nid=0x7ac2 runnable [0x00007f5ae4ccb000]
   java.lang.Thread.State: RUNNABLE
        at sun.nio.ch.EPollArrayWrapper.epollWait(Native Method)
        at sun.nio.ch.EPollArrayWrapper.poll(EPollArrayWrapper.java:269)
        at sun.nio.ch.EPollSelectorImpl.doSelect(EPollSelectorImpl.java:79)
        at sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:86)
        - locked <0x00000000c2e816b0> (a sun.nio.ch.Util$2)
        - locked <0x00000000c2e816a0> (a java.util.Collections$UnmodifiableSet)
        - locked <0x00000000c2e742a0> (a sun.nio.ch.EPollSelectorImpl)
        at sun.nio.ch.SelectorImpl.select(SelectorImpl.java:97)
        at org.apache.kafka.common.network.Selector.select(Selector.java:529)
        at org.apache.kafka.common.network.Selector.poll(Selector.java:321)
        at org.apache.kafka.clients.NetworkClient.poll(NetworkClient.java:433)
        at org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient.poll(ConsumerNetworkClient.java:232)
        - locked <0x00000000c2f00da0> (a org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient)
        at org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient.poll(ConsumerNetworkClient.java:208)
        at org.apache.kafka.clients.consumer.internals.ConsumerNetworkClient.poll(ConsumerNetworkClient.java:168)
        at org.apache.kafka.clients.consumer.internals.AbstractCoordinator.joinGroupIfNeeded(AbstractCoordinator.java:364)
        at org.apache.kafka.clients.consumer.internals.AbstractCoordinator.ensureActiveGroup(AbstractCoordinator.java:316)
        at org.apache.kafka.clients.consumer.internals.ConsumerCoordinator.poll(ConsumerCoordinator.java:297)
        at org.apache.kafka.clients.consumer.KafkaConsumer.pollOnce(KafkaConsumer.java:1078)
        at org.apache.kafka.clients.consumer.KafkaConsumer.poll(KafkaConsumer.java:1043)
        at org.springframework.kafka.listener.KafkaMessageListenerContainer$ListenerConsumer.run(KafkaMessageListenerContainer.java:571)
        at java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:511)
        at java.util.concurrent.FutureTask.run(FutureTask.java:266)
        at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1142)
        at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:617)
        at java.lang.Thread.run(Thread.java:745)
```

##卡顿原因分析
###卡顿原因：Consumer 在 Region Group
根据以上信息，结合 `org.apache.kafka.clients.consumer.internals.ConsumerCoordinator` 的代码可以发现在
`ConsumerCoordinator#poll` 中判断 `needRejoin()` 为 true 时会调用 `ensureActiveGroup()` 函数，如下：
```java
public void poll(long now, long remainingMs) {
        invokeCompletedOffsetCommitCallbacks();
        if (subscriptions.partitionsAutoAssigned()) {
            ...
            if (needRejoin()) {
                ...
                ensureActiveGroup();
                ...
            }
        } else {
             ...
            }
        }

        pollHeartbeat(now);
        maybeAutoCommitOffsetsAsync(now);
    }
```

###Region Group 原因：Consumer Leave Group
那么问题就是什么情况下 org.apache.kafka.clients.consumer.internals.ConsumerCoordinator#needRejoin 会返回 true，我们还是看看他的实现：
```java
@Override
    public boolean needRejoin() {
        if (!subscriptions.partitionsAutoAssigned())
            return false;

        // we need to rejoin if we performed the assignment and metadata has changed
        if (assignmentSnapshot != null && !assignmentSnapshot.equals(metadataSnapshot))
            return true;

        // we need to join if our subscription has changed since the last join
        if (joinedSubscription != null && !joinedSubscription.equals(subscriptions.subscription()))
            return true;

        return super.needRejoin();
    }
```

#kafka metadata 什么时候变化？？？？
可以看到，不是 metadataSnapshot 有变化，也不是 订阅者 subscriptions 有变化，那就是 super.needRejoin() 返回了 true，问题就转到了 `org.apache.kafka.clients.consumer.internals.AbstractCoordinator#needRejoin` 这个函数，其实现是：
```java
protected synchronized boolean needRejoin() {
    return rejoinNeeded;
}
```

从代码上看 `rejoinNeeded` 的整个变化过程，初始化为 true，在 `initiateJoinGroup` 成功后，会赋值为 false，在 `maybeLeaveGroup` 时会赋值为 true，所以怀疑卡顿时是 consumer leave group 了。

##Consumer Leave Group 原因：pollTimeoutExpired
在 `org.apache.kafka.clients.consumer.internals.AbstractCoordinator.HeartbeatThread#run` 中调用了 `maybeLeaveGroup()` 函数，其实现如下：
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

所以是 pollTimeoutExpired 引起了 leave group.

###根本原因：pollTimeoutExpired
pollTimeoutExpired 的原因是两次 poll 的时间间隔超过了设置的 maxPollInterval 值。

##解决方案
调整以下参数
- max.poll.records：100 (默认值 500)
- max.poll.interval.ms：600000 (默认值 300000，也就是5分钟)

##后续
至此，问题已经解决了，但是有一些疑问。
* 对于这两个参数值的设定， 是 `max.poll.records` 越小越好，`max.poll.interval.ms` 越大越好吗？
* 已经设置过的 `session.timeout.ms` 和 `heartbeat.interval.ms `难道没用吗？为什么有这么多超时参数的设置啊？
* 已经设置过的 `max.partition.fetch.bytes` 没用吗？为什么还要设置 `max.poll.records` 啊？
* 整体上还需要调哪些参数才可以让 consumer 运行正常，或者是性能达到最大呢？

在下一篇博客「Kafka Consumer 的实现」中，将会继续分析 Kafka Consumer 的消费过程和参数配置，试图回答以上问题。