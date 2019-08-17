title: HashMap实现原理
date: 2015-02-03 00:30:01
tags: java
---

#HashMap源码分析

##1. 概要
* HashMap是基于Map接口实现的，提供了所有Map支持的操作，并且允许key和value为null。HashMap可以近似地认为是HashTable，其差别仅在于前者允许null的key,value，并且操作不是同步的(unsynchronized)。
* Iteration遍历整个hashMap的时间与hashMap的capacity(buckets的数量)加上hashMap的size的值是成正比的，所以如果想要高效地遍历HashMap，就不要将capacity的初始值设置的太高，也不要将load factor设置的太低。
* 衡量HashMap性能的指标只有两个，一个是capacity的初始值，一个是load factor。
* capacity是指hash表中buckets的数量，而capacity的初始值是指当hash表被创建时capacity被设定的值。
* load factor是用来衡量当hash表扩容之前有多满的指标。load_factor = put_size/size
* 当hash表的元素超过了阈值(loadFactor*capacity)时会自动将内部数据重建一遍，并将buckets的数量翻倍，这个过程称为rehash。
* 根据经验来讲，当load factor为0.75时，较好地权衡了时间和空间上的取舍。load factor高虽然能减少空间的消耗但是增加了查询的代价，主要反映在put和get操作。
* 当设定capacity初始值时需要考虑map中期望地元素个数和load factor，这样能最小化rehash的次数。如果capacity初始值大于最大元素个数除以load factor的值，则永远不会发生load factor操作。
* 如果有很多mapping都要存放到同一个HashMap，那么在最开始就设置一个充足的capacity比当hash表超过阈值后再rehash要高效地多。
* **请注意**：所以的实现都不是synchronized的，如果有多个线程同时操作HashMap，并且有线程会修改HashMap的结构时，则必须要对此操作加synchronized标识。增加或删除HashMap中的元素都算是修改HashMap的结构，如果仅仅只是修改某个key的value则不算。
* 如果没有可以对HashMap做synchronized的对象，那么可以使用
```java
Map m = Collections.synchronizedMap(new HashMap(…)
```
来生成一个同步操作的Map.

##2. HashMap的实现
###2.1 Fields
```java
transient Node<K,V>[] table;;//存储元素的实体数组
transient Set<Map.Entry<K,V>> entrySet; //Holds cached entrySet()
transient int size;//存放元素的个数
int threshold; //当实际大小超过临界值时，会进行扩容threshold = 加载因子*容量, DEFAULT_INITIAL_CAPACITY
final float loadFactor; //加载因子
transient int modCount;//This field is used to make iterators on Collection-views of the HashMap fail-fast
```

###2.2 实现
####2.2.1 java8的改进点
     java.util.HashMap 是JDK里散列的一个实现，JDK6里采用位桶+链表的形式实现，Java8里采用的是位桶+链表/红黑树的方式，this will improve the worst case performance from O(n) to O(log n).。
####2.2.2 访问map的过程
仅以put操作为例来说明，put操作的过程：
     当未冲突时；put的位置为 (tab.length-1)&key.hashCode()
     当冲突时；如果冲突的位置上放的是TreeNode，则加入。否则加入冲突位置的元素链表的最末尾，如果加入后链表长度达到TREEIFY_THRESHOLD，则将链表转为红黑树。
     加入操作完成后，如果size大于threshold则resize。
####2.2.3 hashCode和size
hash函数如下：
```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

tab.length的大小为2的幂次方，实现：
```java
/**
* Returns a power of two size for the given target capacity.
*/
static final int tableSizeFor(int cap) {
    int n = cap - 1;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;
}
```

##3. 遍历HashMap
当需要取出key-value时，推荐
```java
Iterator iter = map.entrySet().iterator();
while (iter.hasNext()) {
    Map.Entry entry = (Map.Entry) iter.next();
    Object key = entry.getKey();
    Object val = entry.getValue();
}
```

##4. 遍历时操作
###4.1 遍历时remove
Removes the current element. Throws IllegalStateException if an attempt is made to call remove() that is not preceded by a call to next( ).
###4.2 keySet的使用
keySet没有实现add(E e)方法，所有当对keySet调用add方法时会抛出UnsupportedOperationException。
KeySet继承关系如下：
```java
class KeySet extends AbstractSet<K>
abstract class AbstractSet<E> extends AbstractCollection<E> implements Set<E>
abstract class AbstractCollection<E> implements Collection<E>{
     public boolean add(E e) {
         throw new UnsupportedOperationException();
}
```
###4.3 直接使用subclass遍历时不允许修改map
```java
for (Instance key : InsMap.keySet()) {
    keySet.remove(instance2);
    System.out.println(InsMap.get(key));
}
```
remove后第二遍进入for循环时会抛ConcurrentModificationException。
原因是KeySet, Values, EntrySet这三个subclass都不允许在遍历过程中map被修改
```java
public final void forEach(Consumer<? super Map.Entry<K,V>> action) {
    Node<K,V>[] tab;
    if (action == null)
        throw new NullPointerException();
    if (size > 0 && (tab = table) != null) {
        int mc = modCount;
        for (int i = 0; i < tab.length; ++i) {
            for (Node<K,V> e = tab[i]; e != null; e = e.next)
                action.accept(e);
        }
        if (modCount != mc)
            throw new ConcurrentModificationException();
    }
}
```