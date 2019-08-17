title: Java的wait和notify
date: 2015-07-30 22:24:01
tags: java
---

#1.java线程同步原理#
java会为每个object对象分配一个monitor，当某个对象的同步方法（synchronized methods ）或同步快被多个线程调用时，该对象的monitor将负责处理这些访问的并发独占要求。

当一个线程调用一个对象的同步方法时，JVM会检查该对象的monitor。如果monitor没有被占用，那么这个线程就得到了monitor的占有权，可以继续执行该对象的同步方法；如果monitor被其他线程所占用，那么该线程将被挂起，直到monitor被释放。

当线程退出同步方法调用时，该线程会释放monitor，这将允许其他等待的线程获得monitor以使对同步方法的调用执行下去。

注意：java对象的monitor机制和传统的临界检查代码区技术不一样。java的一个类一个同步方法并不意味着同时只有一个线程独占执行（不同对象的同步方法可以同时执行），但临界检查代码区技术确会保证同步方法在一个时刻只被一个线程独占执行。

**java的monitor机制的准确含义是：任何时刻，对一个指定object对象的某同步方法只能由一个线程来调用。**

java对象的monitor是跟随object实例来使用的，而不是跟随程序代码。两个线程可以同时执行相同的同步方法，比如：一个类的同步方法是xMethod()，有a,b两个对象实例，一个线程执行a.xMethod()，另一个线程执行b.xMethod(). 互不冲突。

#2. wait(), notify(),notifyAll()#

首先看一下Java中java.lang.Object类的实现：

```
public class Object {
	private static native void registerNatives();
	
	static {
		registerNatives();
  	}
	public final native Class<?> getClass();
	
	public native int hashCode();
	
	public boolean equals(Object obj) {
		return (this == obj);
	}
    
	protected native Object clone() throws CloneNotSupportedException;
	
	public String toString() {
		return getClass().getName() + "@" + Integer.toHexString(hashCode());
	}
    
	public final native void notify();
	
	public final native void notifyAll();
	
	public final native void wait(long timeout) throws InterruptedException;
	
	public final void wait(long timeout, int nanos) throws InterruptedException {
		if (timeout < 0) {
			throw new IllegalArgumentException("timeout value is negative");
		}
		
		if (nanos < 0 || nanos > 999999) {
			throw new IllegalArgumentException("nanosecond timeout value out of range");
		}

		if (nanos >= 500000 || (nanos != 0 && timeout == 0)) {
			timeout++;
		}

        wait(timeout);
	}
    
	public final void wait() throws InterruptedException {
        wait(0);
    }
    
    protected void finalize() throws Throwable { }
}
```

wait()方法是object类的方法，解决的问题是线程间的同步，该过程包含了同步锁的获取和释放，调用wait方法将会将调用者的线程挂起，直到其他线程调用同一个对象的notify()方法才会重新激活调用者。

**注意:线程调用notify()之后，只有该线程完全从 synchronized代码里面执行完毕后，monitor才会被释放，被唤醒线程才可以真正得到执行权。**

使用：

- obj.wait()方法使本线程挂起，并释放obj对象的monitor，只有其他线程调用obj对象的notify()或notifyAll()时，才可以被唤醒。
- obj.notifyAll()方法唤醒所有阻塞在obj对象上的沉睡线程，然后被唤醒的众多线程竞争obj对象的monitor占有权，最终得到的那个线程会继续执行下去，但其他线程继续等待。
- obj.notify()方法是随机唤醒一个沉睡线程，过程更obj.notifyAll()方法类似。

wait，notify和notifyAll只能在同步控制方法或者同步控制块里面使用，例如：

```
synchronized(x){
	x.notify()	
	//或者wait()
}
```

以上内容说明了为什么调用wait()，notify()，notifyAll()的线程必须要拥有obj实例对象的monitor占有权。

每个对象实例都有一个等待线程队列。这些线程都是等待对该对象的同步方法的调用许可。对一个线程来说，有两种方法可以进入这个等待线程队列。一个是当其他线程执行同步方法时，自身同时也要执行该同步方法；另一个是调用obj.wait()方法。

当同步方法执行完毕或者执行wait()时，其他某个线程将获得对象的访问权。当一个线程被放入等待队列时，必须要确保可以通过notify()的调用来解冻该线程，以使其能够继续执行下去。

#3. native#
native is a java keyword. It marks a method, that it will be implemented in other languages, not in Java. The method is declared without a body and cannot be abstract. It works together with JNI (Java Native Interface).
Native methods were used in the past to write performance critical sections but with java getting faster this is now less common. Native methods are currently needed when

You need to call from java a library, written in another language.
You need to access system or hardware resources that are only reachable from the other language (typically C). Actually, many system functions that interact with real computer (disk and network IO, for instance) can only do this because they call native code.