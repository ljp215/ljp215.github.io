title: Java的内存泄露与垃圾回收
date: 2015-11-02 11:39:53
tags: java
---

##什么是内存泄露
内存泄露 memory leak，是指已申请的无用内存无法被回收。

内存泄漏有两种情况：

- 一种情况如在C/C++语言中的，在堆中的分配的内存，在没有将其释放掉的时候，就将所有能访问这块内存的方式都删掉（如指针重新赋值)

- ** 一种情况则是在内存对象明明已经不需要的时候，还仍然保留着这块内存和它的访问方式（引用）**

第一种情况，在Java中已经由于垃圾回收机制的引入，得到了很好的解决。所以，Java中的内存泄漏，主要指的是第二种情况。

内存泄露的一个例子：

```
for (int i = 0; i < 1000; i++) {
      Object obj = new Object(
      list.add(obj);
      obj = null;
}
```

这段代码是：for循环中，new一个Object对象obj，然后将其添加到list中，最后将obj置空。

这个时候就发生了内存泄露，因为obj是可达的无用对象。发生GC时，尽管obj已经被置空成为了无用对象，但是obj能够从list可达，从而GC无法将其释放掉。次数obj占用的内存就是泄露了。

##内存泄露与内存溢出
内存溢出 out of memory，是指程序在申请内存时，没有足够的内存空间供其使用，出现out of memory。当发生内存溢出时，程序将无法进行，强制终止。在java中常见的java.lang.OutOfMemoryError就是内存溢出的log。

**内存长期泄露终将导致内存溢出。**

##内存泄露的危害
一次内存泄露危害可以忽略，但内存长期泄露，可用内存会逐渐减少，导致降低性能，最终内存溢出。

在移动设备对于内存和CPU都有较严格的限制的情况下，Java的内存泄露还会导致程序性能降低甚至崩溃。

##怎么产生内存泄露

容易引起内存泄漏的几大原因

1. 静态集合类

    像HashMap、Vector 等静态集合类的使用最容易引起内存泄漏，因为这些静态变量的生命周期与应用程序一致，如示例1，如果该Vector 是静态的，那么它将一直存在，而其中所有的Object对象也不能被释放，因为它们也将一直被该Vector 引用着。

2. 监听器

    在java 编程中，我们都需要和监听器打交道，通常一个应用当中会用到很多监听器，我们会调用一个控件的诸如addXXXListener()等方法来增加监听器，但往往在释放对象的时候却没有记住去删除这些监听器，从而增加了内存泄漏的机会。

3. 物理连接

    一些物理连接，比如数据库连接和网络连接，除非其显式的关闭了连接，否则是不会自动被GC 回收的。Java 数据库连接一般用DataSource.getConnection()来创建，当不再使用时必须用Close()方法来释放，因为这些连接是独立于JVM的。对于Resultset 和Statement 对象可以不进行显式回收，但Connection 一定要显式回收，因为Connection 在任何时候都无法自动回收，而Connection一旦回收，Resultset 和Statement 对象就会立即为NULL。但是如果使用连接池，情况就不一样了，除了要显式地关闭连接，还必须显式地关闭Resultset Statement 对象（关闭其中一个，另外一个也会关闭），否则就会造成大量的Statement 对象无法释放，从而引起内存泄漏。

4. 内部类和外部模块等的引用

    内部类的引用是比较容易遗忘的一种，而且一旦没释放可能导致一系列的后继类对象没有释放。

##垃圾回收

**可以手动执行垃圾回收吗？**

只能建议jvm进行GC，但什么时候做GC由JVM决定

###System.gc()
可以通过调用System.gc()建议JVM执行垃圾回收，但JVM不保证一定会执行GC操作。通常不推荐使用System.gc()。

###finalize()
finalize()方法存在于java.lang.Object类中，可以被所有对象所使用。默认情况下其不执行任何动作。当垃圾回收器确定了一个对象没有任何引用时，其会调用finalize()方法。但是，finalize方法并不一定会被执行，因此也不建议覆写finalize()该方法。

##内存泄露，会被垃圾回收吗
内存泄露 memory leak，是指已申请的无用内存无法被回收。GC只能回收第一种情况的内存泄露，见前面的释义。

##设置null能防止内存泄露吗
最基本的建议就是尽早释放无用对象的引用，大多数程序员在使用临时变量的时候，都是让引用变量在退出活动域后，自动设置为null。

**不过这个真的有用吗？**

查阅了网上的一些讨论以后有以下结论：

首先，jdk远比我们想象中的聪明，完全能判断出对象是否已经可以回收。但是在极少数情况下，这么做依然是有效的。

**这些情况是：方法前面中有定义大的对象,然后又跟着非常耗时的操作,且没有触发JIT编译。**

> JVM即时编译器：即时编译器（Just In Time Compiler) 简称JIT
     JAVA程序最初是通过解释器（Interpreter）进行解释执行的，当JVM发现某个方法或代码块运行特别频繁的时候，就会认为这是“热点代码”（Hot Spot Code)。
     为了提高热点代码的执行效率，就会将这些“热点代码”编译成与本地机器相关的机器码，进行各个层次的优化。 完成这个任务的编译器就是即时编译器（JIT）。

例如：

```
private void processObj() {
     BigObject obj = … // 声明大对象obj
     doSomethingWith(obj); // 使用obj
     obj = null;    // explicitly set to null
     doSomethingElse(); //非常耗时的操作
}
```

此时显示的设置无用的对象obj为null才有效。

##How to avoid Memory Leak in Java

贴出 [ How to avoid Memory leak issue in Java](http://www.mindfiresolutions.com/How-to-avoid-Memory-leak-issue-in-Java-1001.php) 一文中提到的防止java内存泄露的一些建议。

How  to avoid Memory Leak in Java?

While coding if we take care of a few points we can avoid memory leak issue.

1. Use time out time for the session as low as possible.
2. Release the session when the same is no longer required. We can release the session  by using HttpSession.invalidate().
3. Try to store as less data as possible in the HttpSession.
4. Avoid creating HttpSession in jsp page by default by using the page directive

     <%@page session="false"%>
5. Try to use StringBuffer's append() method instead of string concatenation. String is an immutable object and if we use string concatenation, it will unnecessarily create many temporary objects on heap which results in poor performance.

    For ex. if we write String query =  "SELECT id, name FROM   t_customer whereMsoNormal" style="margin-bottom: 0.0001pt;">     it will create 4 String Objects. But if we write the same query using StringBuffer's append() it will create only one object as StringBuffer is mutable i.e. can be modified over and  over again.
6.  In JDBC code, While writting the query try to avoid "*". It is a good practice to use column name in select statement.
7.  Try to use PreparedStatement object instead of Statement object if the query need to be executed frequently as PreparedStatement is a precompiled SQL statement where as Statement is compiled each time the Sql statement is sent to the database.
8.  Try to close the ResultSet and Statement before reusing those.
9.  If we use stmt = con.prepareStatement(sql query) inside loop, we should close it in the loop.
10. Try to close ResultSet, Statement, PreparedStatement and Connection in finally block.

##在测试内存泄露时，对GC有一些收获
1. cannot disable java gc
2. 我们不能决定什么时候发生GC。
3. System.gc() vs GC button in JVisualVM/JConsole
As far as I know, Jconsole or any other tool, uses System.gc() only. There is no other option. As everyone know, java tells everyone not to rely on System.gc(), but that doesn't mean it doesn't work at all.

##References
>
- http://wwsun.me/posts/jvm-gc.html
- http://java.dzone.com/articles/jvm-and-garbage-collection
- http://www.oracle.com/webfolder/technetwork/tutorials/obe/java/gc01/index.html
- http://chenjingbo.iteye.com/blog/1980908
- http://www.mindfiresolutions.com/How-to-avoid-Memory-leak-issue-in-Java-1001.php
- http://www.infoq.com/cn/articles/cf-java-garbage-references