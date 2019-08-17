title: Java线程中断
date: 2015-04-13 13:55:58
tags:
- java
- 多线程
---

一、Java中断的现象 
首先，看看Thread类里的几个方法： 
public static boolean interrupted	测试当前线程是否已经中断。线程的中断状态 由该方法清除。换句话说，如果连续两次调用该方法，则第二次调用将返回 false（在第一次调用已清除了其中断状态之后，且第二次调用检验完中断状态前，当前线程再次中断的情况除外）。
public boolean isInterrupted()	测试线程是否已经中断。线程的中断状态 不受该方法的影响。
public void interrupt()	中断线程。

Thread.interrupt API:
Interrupts this thread. First the checkAccess method of this thread is invoked, which may cause a SecurityException to be thrown.

If this thread is blocked in an invocation of the wait(), wait(long), or wait(long, int) methods of the Object class, or of the join(), join(long), join(long, int), sleep(long), or sleep(long, int), methods of this class, then its interrupt status will be cleared and it will receive an InterruptedException.

If this thread is blocked in an I/O operation upon an interruptible channel then the channel will be closed, the thread's interrupt status will be set, and the thread will receive a ClosedByInterruptException.

If this thread is blocked in a Selector then the thread's interrupt status will be set and it will return immediately from the selection operation, possibly with a non-zero value, just as if the selector's wakeup method were invoked.

If none of the previous conditions hold then this thread's interrupt status will be set.
```
public void interrupt() {
        if (this != Thread.currentThread())
            checkAccess();

        synchronized (blockerLock) {
            Interruptible b = blocker;
            if (b != null) {
                interrupt0();           // Just to set the interrupt flag
                b.interrupt(this);
                return;
            }
        }
        interrupt0();
    }
```



其实，Java的中断是一种协作机制。也就是说调用线程对象的interrupt方法并不一定就中断了正在运行的线程，它只是要求线程自己在合适的时机中断自己。每个线程都有一个boolean的中断状态（不一定就是对象的属性，事实上，该状态也确实不是Thread的字段），interrupt方法仅仅只是将该状态置为true 
代码如下:

```
public class TestInterrupt { 
public static void main(String[] args) { 
Thread t = new MyThread(); 
t.start(); 
t.interrupt(); 
System.out.println("已调用线程的interrupt方法"); 
} 
static class MyThread extends Thread { 
public void run() { 
int num = longTimeRunningNonInterruptMethod(2, 0); 
System.out.println("长时间任务运行结束,num=" + num); 
System.out.println("线程的中断状态:" + Thread.interrupted()); 
} 
private static int longTimeRunningNonInterruptMethod(int count, int initNum) { 
for(int i=0; i<count; i++) { 
for(int j=0; j<Integer.MAX_VALUE; j++) { 
initNum ++; 
} 
} 
return initNum; 
} 
} 
} 
```

一般情况下，会打印如下内容： 
已调用线程的interrupt方法 
长时间任务运行结束,num=-2 
线程的中断状态:true 
可见，interrupt方法并不一定能中断线程。但是，如果改成下面的程序，情况会怎样呢？ 
代码如下:

```
import java.util.concurrent.TimeUnit; 
public class TestInterrupt { 
public static void main(String[] args) { 
Thread t = new MyThread(); 
t.start(); 
t.interrupt(); 
System.out.println("已调用线程的interrupt方法"); 
} 
static class MyThread extends Thread { 
public void run() { 
int num = -1; 
try { 
num = longTimeRunningInterruptMethod(2, 0); 
} catch (InterruptedException e) { 
System.out.println("线程被中断"); 
throw new RuntimeException(e); 
} 
System.out.println("长时间任务运行结束,num=" + num); 
System.out.println("线程的中断状态:" + Thread.interrupted()); 
} 
private static int longTimeRunningInterruptMethod(int count, int initNum) throws InterruptedException{ 
for(int i=0; i<count; i++) { 
TimeUnit.SECONDS.sleep(5); 
} 
return initNum; 
} 
} 
} 
```

经运行可以发现，程序抛出异常停止了，run方法里的后两条打印语句没有执行。那么，区别在哪里？ 
一般说来，如果一个方法声明抛出InterruptedException，表示该方法是可中断的（没有在方法中处理中断却也声明抛出InterruptedException的除外），也就是说可中断方法会对interrupt调用做出响应（例如sleep响应interrupt的操作包括清除中断状态，抛出InterruptedException），如果interrupt调用是在可中断方法之前调用，可中断方法一定会处理中断，像上面的例子，interrupt方法极可能在run未进入sleep的时候就调用了，但sleep检测到中断，就会处理该中断。如果在可中断方法正在执行中的时候调用interrupt，会怎么样呢？这就要看可中断方法处理中断的时机了，只要可中断方法能检测到中断状态为true，就应该处理中断。让我们为开头的那段代码加上中断处理。 
那么自定义的可中断方法该如何处理中断呢？那就是在适合处理中断的地方检测线程中断状态并处理。 
代码如下:

```
public class TestInterrupt { 
public static void main(String[] args) throws Exception { 
Thread t = new MyThread(); 
t.start(); 
// TimeUnit.SECONDS.sleep(1);//如果不能看到处理过程中被中断的情形，可以启用这句再看看效果 
t.interrupt(); 
System.out.println("已调用线程的interrupt方法"); 
} 
static class MyThread extends Thread { 
public void run() { 
int num; 
try { 
num = longTimeRunningNonInterruptMethod(2, 0); 
} catch (InterruptedException e) { 
throw new RuntimeException(e); 
} 
System.out.println("长时间任务运行结束,num=" + num); 
System.out.println("线程的中断状态:" + Thread.interrupted()); 
} 
private static int longTimeRunningNonInterruptMethod(int count, int initNum) throws InterruptedException { 
if(interrupted()) { 
throw new InterruptedException("正式处理前线程已经被请求中断"); 
} 
for(int i=0; i<count; i++) { 
for(int j=0; j<Integer.MAX_VALUE; j++) { 
initNum ++; 
} 
//假如这就是一个合适的地方 
if(interrupted()) { 
//回滚数据，清理操作等 
throw new InterruptedException("线程正在处理过程中被中断"); 
} 
} 
return initNum; 
} 
} 
} 
```

如上面的代码，方法longTimeRunningMethod此时已是一个可中断的方法了。在进入方法的时候判断是否被请求中断，如果是，就不进行相应的处理了；处理过程中，可能也有合适的地方处理中断，例如上面最内层循环结束后。 
这段代码中检测中断用了Thread的静态方法interrupted，它将中断状态置为false，并将之前的状态返回，而isInterrupted只是检测中断，并不改变中断状态。一般来说，处理过了中断请求，应该将其状态置为false。但具体还要看实际情形。 

二、Java中断的本质 
在历史上，Java试图提供过抢占式限制中断，但问题多多，例如已被废弃的Thread.stop、Thread.suspend和 Thread.resume等。另一方面，出于Java应用代码的健壮性的考虑，降低了编程门槛，减少不清楚底层机制的程序员无意破坏系统的概率。 
如今，Java的线程调度不提供抢占式中断，而采用协作式的中断。其实，协作式的中断，原理很简单，就是轮询某个表示中断的标记，我们在任何普通代码的中都可以实现。 例如下面的代码： 
代码如下:

```
volatile bool isInterrupted; 
//… 
while(!isInterrupted) { 
compute(); 
} 
```

但是，上述的代码问题也很明显。当compute执行时间比较长时，中断无法及时被响应。另一方面，利用轮询检查标志变量的方式，想要中断wait和sleep等线程阻塞操作也束手无策。 
如果仍然利用上面的思路，要想让中断及时被响应，必须在虚拟机底层进行线程调度的对标记变量进行检查。是的，JVM中确实是这样做的。下面摘自java.lang.Thread的源代码： 
代码如下:
```
public static boolean interrupted() { 
return currentThread().isInterrupted(true); 
} 
//… 
private native boolean isInterrupted(boolean ClearInterrupted); 
```

可以发现，isInterrupted被声明为native方法，取决于JVM底层的实现。 
实际上，JVM内部确实为每个线程维护了一个中断标记。但应用程序不能直接访问这个中断变量，必须通过下面几个方法进行操作： 
代码如下:
```
public class Thread { 
//设置中断标记 
public void interrupt() { ... } 
//获取中断标记的值 
public boolean isInterrupted() { ... } 
//清除中断标记，并返回上一次中断标记的值 
public static boolean interrupted() { ... } 
... 
} 
```

通常情况下，调用线程的interrupt方法，并不能立即引发中断，只是设置了JVM内部的中断标记。因此，通过检查中断标记，应用程序可以做一些特殊操作，也可以完全忽略中断。

你可能想，如果JVM只提供了这种简陋的中断机制，那和应用程序自己定义中断变量并轮询的方法相比，基本也没有什么优势。

JVM内部中断变量的主要优势，就是对于某些情况，提供了模拟自动“中断陷入”的机制。 
在执行涉及线程调度的阻塞调用时（例如wait、sleep和join），如果发生中断，被阻塞线程会“尽可能快的”抛出InterruptedException。因此，我们就可以用下面的代码框架来处理线程阻塞中断： 
代码如下:
```
try { 
//wait、sleep或join 
} 
catch(InterruptedException e) { 
//某些中断处理工作 
} 
```

所谓“尽可能快”，我猜测JVM就是在线程调度调度的间隙检查中断变量，速度取决于JVM的实现和硬件的性能。 

三、一些不会抛出 InterruptedException 的线程阻塞操作 
然而，对于某些线程阻塞操作，JVM并不会自动抛出InterruptedException异常。例如，某些I/O操作和内部锁操作。对于这类操作，可以用其他方式模拟中断： 
1）java.io中的异步socket I/O 
读写socket的时候，InputStream和OutputStream的read和write方法会阻塞等待，但不会响应java中断。不过，调用Socket的close方法后，被阻塞线程会抛出SocketException异常。 
2）利用Selector实现的异步I/O 
如果线程被阻塞于Selector.select（在java.nio.channels中），调用wakeup方法会引起ClosedSelectorException异常。 
3）锁获取 
如果线程在等待获取一个内部锁，我们将无法中断它。但是，利用Lock类的lockInterruptibly方法，我们可以在等待锁的同时，提供中断能力。 

四、两条编程原则 
另外，在任务与线程分离的框架中，任务通常并不知道自身会被哪个线程调用，也就不知道调用线程处理中断的策略。所以，在任务设置了线程中断标记后，并不能确保任务会被取消。因此，有以下两条编程原则： 
1）除非你知道线程的中断策略，否则不应该中断它。 
这条原则告诉我们，不应该直接调用Executer之类框架中线程的interrupt方法，应该利用诸如Future.cancel的方法来取消任务。

2）任务代码不该猜测中断对执行线程的含义。 
这条原则告诉我们，一般代码遇在到InterruptedException异常时，不应该将其捕获后“吞掉”，而应该继续向上层代码抛出。 
总之，Java中的非抢占式中断机制，要求我们必须改变传统的抢占式中断思路，在理解其本质的基础上，采用相应的原则和模式来编程。


总结：

要使任务和线程能安全、快速、可靠地停止下来，并不是一件容易的事。Java没有提供任何机制来安全地终止线程。但它提供了中断（Interruption），这是一种协作机制，能够使一个线程终止另一个线程的的工作。—— 『Java并发编程实战』 第7章 取消与关闭 p111

中断是一种协作机制。一个线程不能强制其它线程停止正在执行的操作而去执行其它的操作。当线程A中断B时，A仅仅是要求B在执行到某个可以暂停的地方停止正在执行的操作——前提是如果线程B愿意停下来。—— 『Java并发编程实战』 第5章 基础构建模块 p77

总之，中断只是一种协作机制，需要被中断的线程自己处理中断。停止一个线程最佳实践是 中断 + 条件变量。
refer：
> http://www.infoq.com/cn/articles/java-interrupt-mechanism
>《Java Concurrency in Practice》
>《Concurrent Programming in Java Design principles and patterns》
> http://docs.oracle.com/javase/1.4.2/docs/guide/misc/threadPrimitiveDeprecation.html
> http://ibruce.info/2013/12/19/how-to-stop-a-java-thread/