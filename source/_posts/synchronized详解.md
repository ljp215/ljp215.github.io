title: synchronized详解
date: 2015-07-14 09:04:27
tags:
- java
- 多线程
---
synchronized关键字简洁、清晰、语义明确，因此即使有了Lock接口，使用的还是非常广泛。其应用层的语义是可以把任何一个非null对象作为”锁”。<br>synchronized在软件层面依赖JVM，Lock在硬件层面依赖特殊的CPU指令。

#1. JVM如何实现synchronized#
在java语言中存在两种内建的synchronized语法：synchronized语句和synchronized方法。
synchronized语句被javac编译成bytecode时，会在同步块的入口位置和退出位置分别插入monitorenter和monitorexit字节码指令。
synchronized方法被javac编译成bytecode时，会被翻译成普通的方法调用和返回指令如:invokevirtual、areturn指令，在VM字节码层面并没有任何特别的指令来实现被synchronized修饰的方法，而是在Class文件的方法表中将该方法的access_flags字段中的synchronized标志位置1，表示该方法是同步方法并使用调用该方法的对象或该方法所属的Class在JVM的内部对象表示Klass做为锁对象。

#2. hotspot当前对synchronized的实现#
当前的hotspot共有3种类型的锁，来实现synchronize的语义，之所以有3种，是因为这3种要解决的问题不同，所做的优化也不同。这3种锁分别为biased locking，stack lock，infalted(ObjectMonitor).简单除暴的来讲，从轻量级上来说，biased lock最优，inflated 最差。

#3. synchronized锁住的是什么#
synchronized锁定的是对象而非函数或代码。
**当synchronized作用在方法上时，锁住的便是对象实例（this）；当作用在静态方法时锁住的便是对象对应的Class实例，因为Class数据存在于永久带，因此静态方法锁相当于该类的一个全局锁；当synchronized作用于某一个对象实例时，锁住的便是对应的代码块。**
每个对象只有一把锁(Lock)与之关联，当进行到synchronized语句或函数的时候，这把锁就会被当前的线程（thread）拿走，其他的（thread）再去访问的时候拿不到锁就被暂停了。
在HotSpot JVM实现中，锁有个专门的名字：对象监视器。

#4. synchronized的使用场景#
1. public synchronized void method1
    锁住的是该对象,类的其中一个实例，当该对象(仅仅是这一个对象)在不同线程中执行这个同步方法时，线程之间会形成互斥。达到同步效果，但如果不同线程同时对该类的不同对象执行这个同步方法时，则线程之间不会形成互斥，因为他们拥有的是不同的锁。
2. synchronized(this){ //TODO } 
    同一
3. public synchronized static void method3 
    锁住的是该类，当所有该类的对象(多个对象)在不同线程中调用这个static同步方法时，线程之间会形成互斥，达到同步效果，但如果多个线程同时调用method1，method3，则不会引互斥，具体讲看最后讲解。
4. synchronized(Test.class){ //TODO} 
    同三
5. synchronized(o) {} 
    这里面的o可以是一个任何Object对象或数组，并不一定是它本身对象或者类，谁拥有o这个锁，谁就能够操作该块程序代码。

#refers#
>周志明的《深入理解Java虚拟机》
https://blogs.oracle.com/dave/entry/biased_locking_in_hotspot
http://www.javaworld.com/article/2076971/java-concurrency/how-the-java-virtual-machine-performs-thread-synchronization.html
http://f.dataguru.cn/thread-472518-1-1.html