title: 本地连机房Spark的调试过程
date: 2015-11-13 21:19:27
tags: Spark
---

##调试过程

本地运行代码，输出如下：

```
15/11/12 12:09:51 INFO SparkContext: Running Spark version 1.5.1
Exception in thread "main" java.lang.NoClassDefFoundError: scala/collection/GenTraversableOnce$class
    at org.apache.spark.util.TimeStampedWeakValueHashMap.<init>(TimeStampedWeakValueHashMap.scala:42)
    at org.apache.spark.SparkContext.<init>(SparkContext.scala:287)
Caused by: java.lang.ClassNotFoundException: scala.collection.GenTraversableOnce$class
```

查了半天没有任何结果，大家分析的原因各式各样。后来看到了一位仁兄总结的帖子：[solve spark issue of all masters are unresponsive](http://zhangyi.farbox.com/post/wen-ti-jie-jue/solve-spark-issue-of-all-masters-are-unresponsive)，跑去spark机器看了一下log，果然有收获。

spark日志：

```
ReliableDeliverySupervisor: Association with remote system [akka.tcp://sparkDriver@100.64.80.93:57108] has failed, address is now gated for [5000] ms. Reason is: [scala.Option; local class incompatible: stream classdesc serialVersionUID = -114498752079829388, local class serialVersionUID = -2062608324514658839].
```

根据 scala.Option; local class incompatible 可以发现是 scala 的版本不对，spark 默认的是 scala-2.10，需要改变依赖的scala版本。

改完以后又发现，还是连接不上。本地的输出：

```
15/11/12 21:46:22 ERROR SparkUncaughtExceptionHandler: Uncaught exception in thread Thread[appclient-registration-retry-thread,5,main]
java.util.concurrent.RejectedExecutionException: Task java.util.concurrent.FutureTask@5430d0ff rejected from java.util.concurrent.ThreadPoolExecutor@7819693b[Running, pool size = 1, active threads = 0, queued tasks = 0, completed tasks = 1]
    at java.util.concurrent.ThreadPoolExecutor$AbortPolicy.rejectedExecution(ThreadPoolExecutor.java:2047)
    at java.util.concurrent.ThreadPoolExecutor.reject(ThreadPoolExecutor.java:823)
    at java.util.concurrent.ThreadPoolExecutor.execute(ThreadPoolExecutor.java:1369)
    at java.util.concurrent.AbstractExecutorService.submit(AbstractExecutorService.java:112)
```

spark的日志如下：

A

```
15/11/12 21:46:03 ERROR ErrorMonitor: dropping message [class akka.actor.ActorSelectionMessage] for non-local recipient [Actor[akka.tcp://sparkMaster@10.19.27.215:4041/]] arriving at [akka.tcp://sparkMaster@10.19.27.215:4041] inbound addresses are [akka.tcp://sparkMaster@master1:4041]
```

B

```
15/11/12 22:00:41 WARN ReliableDeliverySupervisor: Association with remote system [akka.tcp://sparkDriver@100.64.80.93:61812] has failed, address is now gated for [5000] ms. Reason is: [Disassociated].
```

关于B这部分的log，怀疑是测试环境的spark的网络访问权限没有打开！最后打开网络访问权限后解决。spark master和worker之间的通信使用的是akka，tcp协议。

spark的A部分log和本地的log是一致的。

第二天接着查，查了很多地方。怀疑是Spark的配置不正确。
对于Spark的配置，官网说的是：

Options for the daemons used in the standalone deploy mode

SPARK_MASTER_IP, to bind the master to a different IP address or hostname

而我spark机器上的设置是：

1. conf/spark-env.sh: export SPARK_MASTER_IP=master1
2. /etc/hosts: 10.x.xxx.215 master1

一切配置正确但依然不行。Google上到处寻觅，找到 spark 的 group 里面的一个帖子，[https://groups.google.com/forum/#!topic/spark-users/SKE4UOUQ_U8](https://groups.google.com/forum/#!topic/spark-users/SKE4UOUQ_U8)，提到
>Yes, this message means that one of the workers tried to contact you using your IP address (10.129.7.154), but Akka is (somewhat stupidly) configured to rely on a DNS name (namely ip-10-129-7-154). If you've set up the Spark standalone mode, there was a bug in the scripts where they would use an IP address for the master instead of a hostname.

所以当我将 SMART_IP 改成 ip 而不是 hostname 后，本地终于能连上spark了，设置如下：

conf/spark-env.sh: export SPARK_MASTER_IP=10.x.xxx.215

##几点备忘
1. 通过 %% 方法获取正确的 Scala 版本
如果你用是 groupID %% artifactID % revision 而不是 groupID % artifactID % revision（区别在于 groupID 后面是 %%），sbt 会在 工件名称中加上项目的 Scala 版本号。 这只是一种快捷方法。你可以这样写不用 %%：

2. enable build.sbt auto import
修改了 build.sbt，但是包没有引入生效

3. ./spark-shell 加载配置文件
在Spark 集群上运行一个应用,只需通过master的 spark://IP:PORT 链接传递到SparkContext构造器
在集群上运行交互式的Spark 命令, 运行如下命令：
MASTER=spark://IP:PORT ./spark-shell
注意，如果你在一个 spark集群上运行了spark-shell脚本，spark-shell 将通过在conf/spark-env.sh下的SPARK_MASTER_IP和SPARK_MASTER_PORT自动设置MASTER
