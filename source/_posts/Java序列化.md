title: Java序列化
date: 2016-01-03 09:49:17
tags: java
---

## 什么是序列化
java 序列化是将对象转化为二进制流。不同的序列化框架会将对象转成不同的二进制流。通过 [透过byte数组简单分析Java序列化、Kryo、ProtoBuf序列化][1] 这篇文章里可以看到，不同的序列化框架最终转成的二进制流是不一样的。


## Java 默认序列化
### 默认序列化机制
如果仅仅只是让某个类实现Serializable接口，而没有其它任何处理的话，则就是使用默认序列化机制。使用默认机制，在序列化对象时，不仅会序列化当前对象本身，还会对该对象引用的其它对象也进行序列化，同样地，这些其它对象引用的另外对象也将被序列化，以此类推。所以，如果一个对象包含的成员变量是容器类对象，而这些容器所含有的元素也是容器类对象，那么这个序列化的过程就会较复杂，开销也较大。

整个过程都是Java虚拟机（JVM）独立的，也就是说，在一个平台上序列化的对象可以在另一个完全不同的平台上反序列化该对象。


### serialVersionUID
serialVersionUID的作用
不仅取决于类路径和功能代码是否一致，一个非常重要的一点是两个类的序列化 ID 是否一致（就是 `private static final long serialVersionUID = 1L`）


### Java 序列化实现
#### ObjectInputStream && ObjectOutputStream
类ObjectInputStream 和ObjectOutputStream是高层次的数据流，它们包含序列化和反序列化对象的方法。
ObjectOutputStream 类包含很多写方法来写各种数据类型，但是一个特别的方法例外：

	public final void writeObject(Object x) throws IOException

上面的方法序列化一个对象，并将它发送到输出流。相似的ObjectInputStream 类包含如下反序列化一个对象的方法：

	public final Object readObject() throws IOException, ClassNotFoundException

该方法从流中取出下一个对象，并将对象反序列化。它的返回值为Object，因此，你需要将它转换成合适的数据类型。


#### Serializable 接口
情境：一个子类实现了 Serializable 接口，它的父类都没有实现 Serializable 接口，序列化该子类对象，然后反序列化后输出父类定义的某变量的数值，该变量数值与序列化时的数值不同。
解决：要想将父类对象也序列化，就需要让父类也实现Serializable 接口。如果父类不实现的话的，就 需要有默认的无参的构造函数。在父类没有实现 Serializable 接口时，虚拟机是不会序列化父对象的，而一个 Java 对象的构造必须先有父对象，才有子对象，反序列化也不例外。所以反序列化时，为了构造父对象，只能调用父类的无参构造函数作为默认的父对象。因此当我们取父对象的变量值时，它的值是调用父类无参构造函数后的值。如果你考虑到这种序列化的情况，在父类无参构造函数中对变量进行初始化，否则的话，父类变量值都是默认声明的值，如 int 型的默认是 0，string 型的默认是 null。


#### Externalizable 接口
无论是使用transient关键字，还是使用writeObject()和readObject()方法，其实都是基于Serializable接口的序列化。JDK中提供了另一个序列化接口—Externalizable，使用该接口之后，之前基于Serializable接口的序列化机制就将失效。
writeExternal：把一个Java对象写入到流中
readExternal：从流中读取一个Java对象


## java序列化一览
![](img/java_serialize_%20summary.png)


## Java 序列化框架比较
### 性能比较
![](img/serialize_performance_compare.png)


### 测试方法
[jvm-serializers][2] 提供了一个很好的比较各种Java序列化的的测试套件。 它罗列了各种序列化框架， 可以自动生成测试报告。


### 适用性比较
- json
json的序列化框架有fastjson,jackson,gson等。
适用于数据量小，实时性较低（例如秒级别）的服务。JSON格式具有非常强的前后兼容性，并且调式方便，所以对客户端与服务端的通讯尤其适用。
- xml
xml的序列化框架有XStream。XML的序列化和反序列化的空间和时间开销都比较大，对于对性能要求在ms级别的服务，不推荐使用。
- hessian
hessian主要用于java序列化。它的实现机制是着重于数据，附带简单的类型信息的方法：
- 对于简单的数据类型。就像Integer a = 1，hessian会序列化成I 1这样的流，I表示int or Integer，1就是数据内容。
	- 对于复杂对象，通过Java的反射机制，hessian把对象所有的属性当成一个Map来序列化，产生类似M className propertyName1 I 1 propertyName S stringValue
	- 对于引用对象，在序列化过程中，如果一个对象之前出现过，hessian会直接插入一个R index这样的块来表示一个引用位置，从而省去再次序列化和反序列化的时间。
- thift
Thrift是Facebook开源提供的一个高性能，轻量级RPC服务框架，其产生正是为了满足当前大数据量、分布式、跨语言、跨平台数据通讯的需求。 但是，Thrift并不仅仅是序列化协议，而是一个RPC框架。相对于JSON和XML而言，Thrift在空间开销和解析性能上有了比较大的提升，对于对性能要求比较高的分布式系统，它是一个优秀的RPC解决方案；但是由于Thrift的序列化被嵌入到Thrift框架里面，Thrift框架本身并没有透出序列化和反序列化接口，这导致其很难和其他传输层协议共同使用（例如HTTP）。
- protobuf
	序列化数据非常简洁，紧凑，析速度非常快，提供了非常友好的动态库。使用简介，反序列化只需要一行代码。但是在JavaBean和proto之间的转换较麻烦。
- avro
Avro的产生解决了JSON的冗长和没有IDL的问题。 Avro提供两种序列化格式：JSON格式或者Binary格式。Binary格式在空间开销和解析性能方面可以和Protobuf媲美，JSON格式方便测试阶段的调试。
- 动态类型：Avro并不需要生成代码，模式和数据存放在一起，而模式使得整个数据的处理过程并不生成代码、静态数据类型等等。这方便了数据处理系统和语言的构造。
	- 未标记的数据：由于读取数据的时候模式是已知的，那么需要和数据一起编码的类型信息就很少了，这样序列化的规模也就小了。
	- 不需要用户指定字段号：即使模式改变，处理数据时新旧模式都是已知的，所以通过使用字段名称可以解决差异问题。

Reference
> [https://www.ibm.com/developerworks/cn/java/j-lo-serial/][3]
> [http://www.infoq.com/cn/articles/serialization-and-deserialization][4]
> [http://sqtds.github.io/2015/05/13/2015/java-serizable/][5]
> [http://www.solinx.co/archives/377][6]

[1]:	http://www.solinx.co/archives/377
[2]:	https://github.com/eishay/jvm-serializers
[3]:	https://www.ibm.com/developerworks/cn/java/j-lo-serial/
[4]:	http://www.infoq.com/cn/articles/serialization-and-deserialization
[5]:	http://sqtds.github.io/2015/05/13/2015/java-serizable/
[6]:	http://www.solinx.co/archives/377