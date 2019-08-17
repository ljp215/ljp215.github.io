title: 并查集(Union-Find)算法
date: 2016-02-02 17:52:22
tags: 算法
---

## 介绍
在计算机科学中，并查集是一种树型的数据结构，其保持着用于处理一些不相交集合（Disjoint Sets）的合并及查询问题。有一个联合-查找算法（union-find algorithm）定义了两个操作用于此数据结构：

Find：确定元素属于哪一个子集。它可以被用来确定两个元素是否属于同一子集。

Union：将两个子集合并成同一个集合。

## 适用场景
适合于判断，给出一组结点，判断他们是否联通。

## 实现思路
1. 建立n个分组，每个分组代表一堆可以互相联通的结点。
2. 遍历每对结点，找到他们各自所属的分组A, B
3. 如果A != B，则将A, B分组union起来，表示A, B分组联通了
4. 如果A == B，则跳过

### Simple Find 操作
用 group[] 数组来判断某个id属于的组。初始状态时，每个id都属于不同的组。

```
for(int i = 0; i < size; i++)  
    group[i] = i;   
```

### Simple Union 操作

```
public void union(int p, int q) {   
  // get the groupId of every node
  int pId = find(p);  
  int qId = find(q);  
  
  // the two nodes are connected, return
  if (pId == qId) {
    return;  
  }
  
  // union the two nodes, change groupId
  for (int i = 0; i < id.length; i++) {
      if (group[i] == pId) {
        group[i] = qId;  
      }
  }
}  
```

### 优化
上面最后一步的union操作存在性能问题，即每次都需要改变其中一个分组中的所有结点的分组id。优化的做法是，用一颗树来表示每个分组，树的根节点表示当前组的id。

但如果用树来表示会引入一个问题，即可能存在树退化为链表的情况，这样一来，每一次加入一个结点再找根结点也会很耗时，没有达到优化的目的。
针对树可能退化为链表的解决方案是，每次合并树时，总是将矮的树挂到高的树下。这种方式也称为「按秩合并」

除了使用树来优化union性能以外，还有一种方式，称为「路径压缩」，即 Find 递归地经过树，改变每一个节点的引用到根节点。得到的树将更加扁平，为以后直接或者间接引用节点的操作加速。

总结：

1. 使用树来存储分组，Union时「按秩合并」
2. 「路径压缩」，Find时改变每一个节点的引用到根节点

### Find 操作

```
// store every tree's size
for (int i = 0; i < N; i++)  
    size[i] = 1;     
```

```
private int find(int p)  
{    
  if(p != group[p]){
    group[p] = find(group[p])
  }
    
  return group[p]
}  
```

### Union 操作
```
public void union(int p, int q)
{
	int i = find(p);
	int j = find(q);
	
	if (i == j) {
	  return;
	} 
	
	if (size[i] < size[j]) { 
	  group[i] = j; 
	  size[j] += size[i]; 
	}	else { 
	  group[j] = i; 
	  size[i] += size[j]; 
	}
}
```

### 时间复杂度
Statement: If m operations, either Union or Find, are applied to n elements, the total run time is O(m log*n), where log* is the iterated logarithm.
Proof of O(log*n) time complexity of union-find: https://en.wikipedia.org/wiki/Proof_of_O\(log*n)_time_complexity_of_union%E2%80%93find

## Refer 
> https://zh.wikipedia.org/wiki/%E5%B9%B6%E6%9F%A5%E9%9B%86
> http://blog.csdn.net/dm_vincent/article/details/7655764
> https://en.wikipedia.org/wiki/Proof_of_O(log*n)_time_complexity_of_union%E2%80%93find





