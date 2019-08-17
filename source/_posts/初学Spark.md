title: 初学Spark
date: 2016-01-22 11:41:20
tags: spark
---

# 避免使用 GroupByKey

当调用 groupByKey 时，所有的键值对(key-value pair) 都会被移动。在网络上传输这些数据非常没有必要。

以下函数应该优先于 groupByKey :

- combineByKey    
  组合数据，但是组合之后的数据类型与输入时值的类型不一样。
  
- foldByKey 
  合并每一个 key 的所有值，在级联函数和“零值”中使用。
  

#combineByKey

## combineByKey的定义

```
def combineByKey[C](
  createCombiner: V => C,
  mergeValue: (C, V) => C, 
  mergeCombiners: (C, C) => C, 
  partitioner: Partitioner, 
  mapSideCombine: Boolean = true, 
  serializer: Serializer = null): RDD[(K, C)] = {
  // do something
}
```

combineByKey函数主要接受了三个函数作为参数，分别为createCombiner、mergeValue、mergeCombiners。这三个函数足以说明它究竟做了什么。理解了这三个函数，就可以很好地理解combineByKey。

### createCombiner
createCombiner：在遍历RDD的过程中，对于遍历到的(k,v)，如果是第一次遇到，则对这个(k,v)调用createCombiner函数，它的作用是将v转换为c(类型是C，即聚合对象的类型，c作为聚合对象的初始值)

### mergeValue
mergeValue：在遍历RDD的过程中，对于遍历到的(k,v)，如果不是第一次(而是第i次, 1 < i <= n)遇到，那么将对这个(k,v)调用mergeValue函数，它的作用是将v累加到聚合对象（类型C）中，mergeValue的类型是(C,V)=>C,参数中的C遍历到此处的聚合对象，然后对v进行聚合得到新的聚合对象值

### mergeCombiners
mergeCombiners：**因为combineByKey是在分布式环境下执行，RDD的每个分区单独进行combineByKey操作，最后需要对各个分区的结果进行最后的聚合**。它的函数类型是(C,C)=>C，每个参数是分区聚合得到的聚合对象。

### combineByKey的流程
- 假设一组具有相同 K 的 <K, V> records 正在一个个流向 combineByKey()，createCombiner 将第一个 record 的value 初始化为 c （比如，c = value），然后从第二个 record 开始，来一个 record 就使用 mergeValue(c,
- record.value) 来更新 c，比如想要对这些 records 的所有 values 做 sum，那么使用 c = c + record.value。等到records 全部被 mergeValue()，得到结果 c。假设还有一组 records（key 与前面那组的 key 均相同）一个个到来，
- combineByKey() 使用前面的方法不断计算得到 c'。现在如果要求这两组 records 总的 combineByKey() 后的结果，那么可以使用 final c = mergeCombiners(c, c') 来计算。

## Example

```
var rdd1 = sc.makeRDD(Array(("A",1),("A",2),("A",3),("B",1),("B",2),("C",3)))

// result: ((A,1_$2_@3), (B,1_$2_), (C,3_))
rdd1.combineByKey(
  (v : Int) => v + "_",
  (c : String, v : Int) => c + "@" + v,
  (c1 : String, c2 : String) => c1 + "$" + c2 ).collect
```

## combineByKey应用举例

### 求均值

```
val rdd = sc.textFile("气象数据")
val rdd2 = rdd.map(x=>x.split(" ")).map(x => (x(0).substring("从年月日中提取年月"),x(1).toInt))
val createCombiner = (k: String, v: Int)=> {
  (v,1)
}
val mergeValue = (c:(Int, Int), v:Int) => {
  (c._1 + v, c._2 + 1)
}

val mergeCombiners = (c1:(Int,Int),c2:(Int,Int))=>{
  (c1._1 + c2._1, c1._2 + c2._2)
}

val vdd3 = vdd2.combineByKey(
  createCombiner,
  mergeValue,
  mergeCombiners
)

rdd3.foreach(x=>println(x._1 + ": average tempreture is " + x._2._1/x._2._2)
```