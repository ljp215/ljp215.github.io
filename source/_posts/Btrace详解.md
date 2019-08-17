title: Btrace详解
date: 2015-08-20 16:01:19
tags: 
- 调试
- java
---

#1. Btrace的简介#
Btrace是由Kenai 开发的一个开源项目，是一种动态跟踪分析JAVA源代码的工具。它可以用来帮我们做运行时的JAVA程序分析，监控等等操作。

#2. 官方参考手册#
<https://kenai.com/projects/btrace/pages/UserGuide>


#3. 实例#

```
import com.sun.btrace.annotations.*;
import com.sun.btrace.AnyType;
import static com.sun.btrace.BTraceUtils.*;

@BTrace
public class TestServiceImplTrace {
    @TLS
    private static long service_get_data_startTime = 0;

    @OnMethod(
            clazz = "com.xxx.mms.test.impl.TestServiceImpl",
            method = "getTestData"
    )
    public static void startTestServiceImplExecute() {
        section_facade_impl_startTime = timeMillis();
    }

    @OnMethod(
            clazz = "com.xxx.mms.test.impl.TestServiceImpl",
            method = "getTestData"
            location = @Location(Kind.RETURN)
    )
    public static void endTestServiceImplExecute(AnyType[] args) { // 传入所有参数
        long time = timeMillis() - section_facade_impl_startTime;

        Object obj = args[4];
        Integer end = (Integer)obj; // 将第5个参数转成Integer

        printFields(args[0]); // 打印第1个参数的所有成员变量的值

        if(end == 6){
                print(strcat(“service getTestData execute time(millis): ", str(time)));
                print(strcat(“\t string param: ", str(args[3]))); // 将第4个参数转成string并打印
                println(strcat(“\t end: ", str(end)));
        }
    }
}
```

#4. 心得#
1. btrace脚本的函数都没有走进去时，btrace pid tracing.java 是得不到结果的。
2. Kind.LINE指向的行必须是代码能运行到的行。比如，以括号结束的行和空行都是无效的。
3. 在刚启动btrace脚本监控时，会存在较大的耗时
4. print有很多功能：
     printNumberMap
     printFields： print 每个域
     printArray：print 数组
5. 如果服务的qps较低(0.2),直接去机器上app222通过ip请求，btrace的event不好用也达不到触发某个请求的目的，这个时候可以直接在本机请求此server的api，虽然与实际情况不符，但是能知道耗时的比例关系。


#5. Btrace的原理#
Btrace是由：Attach API + BTrace脚本解析引擎 + ASM + JDK6 Instumentation组成。简单来说就是：用Attach API附加*.jar然后使用BTrace脚本解析引擎 + ASM来实现对类的修改，在使用Instumentation实现类的内存替换。可详细的说明可以看refers的几篇文章。

#6. 使用Btrace对java进程的影响#
- 装载时的影响：
btrace每次使用，都会重新load所有的class。当然如果OnMethod不匹配，是不会被重新装载。所以跟你的OnMethod的匹配规则很有关系，如果使用+java.lang.Object。那就死定了。
- 退出后的影响：
btrace监控每次退出后，原先所有的class都不会被恢复，你的所有的监控代码依然一直在运行

抓取了下btrace改写过后的类：

```
public InstrumentServer(String ip, String port)
{
     $btrace$com$agapple$btrace$Instrumentor$InstrumentTracer$bufferMonitor(this);
     this.ip = ip;
     this.port = port;
}
```

```
private static void $btrace$com$agapple$btrace$Instrumentor$InstrumentTracer$bufferMonitor(@Self Object arg0)
{
     if (!BTraceRuntime.enter(InstrumentTracer.runtime)) return;
     try {
          Field ipField = BTraceUtils.field("com.agapple.btrace.Instrumentor.InstrumentServer", "ip");
          Field portField = BTraceUtils.field("com.agapple.btrace.Instrumentor.InstrumentServer", "port");
 
          String ip = (String)BTraceUtils.get(ipField, self);
          String port = (String)BTraceUtils.get(portField, self);

          BTraceUtils.println(BTraceUtils.strcat(BTraceUtils.strcat(BTraceUtils.strcat("ip : ", BTraceUtils.str(ip)), " port : "), BTraceUtils.str(port)));
          BTraceRuntime.leave(); return; } catch (Throwable localThrowable) { BTraceRuntime.handleException(localThrowable);
     }
}
```

注意其中的

```
if (!BTraceRuntime.enter(InstrumentTracer.runtime)) return;
```

再看一下BTraceRuntime中对应方法的实现：

```
private volatile boolean disabled;
public static boolean enter(BTraceRuntime current) {
     if (current.disabled) return false;
     return map.enter(current);
}
```

每次执行你的监控代码之前会先进行一个判断，判断当前是否处于监控中。你的客户端发起了exit指令后，该方法判断false，直接return。

**所以btrace使用退出后会让你的代码多走了一个方法调用+一个对象属性判断，所以说影响还是非常少的。**

#7. 推荐阅读#
Btrace系列之一：Btrace的基本原理 http://victorzhzh.iteye.com/blog/965789
btrace一些你不知道的事(源码入手) http://agapple.iteye.com/blog/1005918

#refers#
>
Java SE 6 新特性: Instrumentation 新功能 http://www.ibm.com/developerworks/cn/java/j-lo-jse61/
Btrace系列之一：Btrace的基本原理 http://victorzhzh.iteye.com/blog/965789
btrace一些你不知道的事(源码入手) http://agapple.iteye.com/blog/1005918
