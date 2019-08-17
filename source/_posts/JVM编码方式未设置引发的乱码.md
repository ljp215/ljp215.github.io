title: JVM编码方式未设置引发的乱码
date: 2015-02-04 22:37:58
tags: java
---
######现象：
服务中出现大量乱码数据，并且全部入库。

######原因：
虽然maven项目的pom.xml文件中已配置成UTF-8，并且打出的jar包编码也是UTF-8，但运行时出现中文全是乱码。
发现是系统环境变量中未设置LANG相关变量为UTF-8导致的。
  
######分析：
这是表面原因，究其根本，为什么JVM运行jar包的编码方式会依赖系统环境变量呢？查到原因是因为运行jar包时未指定jvm的 file.encoding参数，改为
```java
java -Dfile.encoding=UTF-8 XXX 后彻底解决。
```
但是这样发布服务时就太依赖发布脚本了，那能否在程序中就设置好编码呢？比如这样：
```java
System.setProperty("file.encoding", "UTF-8");
```
其实，这样设置是不生效的，因为JVM在启动时就开始cache编码方式了，程序中再设置已然无效。不过可以在程序每个读写数据的地方都设置编码方式，但是这样未免太工程浩大，而且无法保证每个写代码的人都能做到。所以最后改为依赖在发布脚本中设置编码方式，并且在服务启动时对编码进行检查。
  
######refer:
> As Edward Grech points out, in a special case like this, the environment variable JAVA_TOOL_OPTIONS can be used to specify this property, but it's normally done like this: java -Dfile.encoding=UTF-8 XXX

> Charset.defaultCharset() will reflect changes to the file.encoding property, but most of the code in the core Java libraries that need to determine the default character encoding do not use this mechanism.

> **Important points to note:**
* JVM caches value of default character encoding once JVM starts and so is the case for default constructors of InputStreamReader and other core Java classes. So calling System.setProperty("file.encoding" , "UTF-16") may not have desire effect.
* Always work with your own character encoding if you can, that is more accurate and precise way of converting bytes to Strings.