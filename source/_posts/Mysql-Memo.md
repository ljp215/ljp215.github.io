title: Mysql Memo
date: 2015-11-10 23:08:03
tags: mysql
---

##1. contact

MySQL CONCAT function is used to concatenate two strings to form a single string.

MySQL GROUP_CONCAT() function returns a string with concatenated non-NULL value from a group.

数据库Person表的内容如下：

| id | name | source| age   |
|:--:|:----:|:-----:|:-----:|
| 1  |  A   |   GP  |   6   |
| 2  |  B   |   GP  |   2   |
| 3  |  A   |   FB  |   1   |
| 4  |  C   |   FB  |   4   |
| 5  |  D   |   FB  |   5   |
| 6  |  A   |   FB  |   3   |
| 7  |  C   |   TW  |   7   |

<br>

1.SQL:

```
select name, count(distinct source) as sourceCount,
group_concat(distinct source separator "/") as sources
from Person
group by name;
```

Query Result:

| name | sourceCount | sources|
|:----:|:-----------:|:------:|
|  A   |      2      | GP/FB  |
|  B   |      1      | GP     |
|  C   |      2      | GP/TW  |
|  D   |      1      | FB     |

<br>

2.SQL:

```
select name, count(distinct source) as sourceCount,
group_concat(distinct source separator "/") as sources
from Person
group by name
having sourceCount = 1 and sources = 'FB';
```

Query Result:

| name | sourceCount | sources|
|:----:|:-----------:|:------:|
|  D   |      1      | FB     |

<br>

3.SQL:

```
select name, count(distinct age) as ageCount,
group_concat(age order by age separator "#") as ages
from Person;
```

Query Result:

| name |  ageCount  |  ages |
|:----:|:----------:|:-----:|
|  A   |      3     | 1#3#6 |
|  B   |      1     |   2   |
|  C   |      2     |  4#7  |
|  D   |      1     |   5   |

##2. mysql -N 不显示字段名
普通的查询语句，查询结果中带字段名

```
 mysql -h xxxx -P 8000 -u'xxx' -p'xxx' -D xxdb
-e "select name from Person where name = 'A'";
 ```

+-----------+

| name      |

+-----------+

| not found |

+-----------+

带-N的查询语句，查询结果中不带字段名

```
 mysql -N -h xxxx -P 8000 -u'xxx' -p'xxx' -D xxdb
-e "select name from Person where name = 'A'";
 ```

+-----------+

| not found |

+-----------+

##3. IFNULL
使用IFNULL能判断是否有查到结果。
在shell中跑mysql的指令容易出现空行，此时用IFNULL是最合适的了。

```
 mysql -N -h xxxx -P 8000 -u'xxx' -p'xxx' -D xxdb
-e "select IFNULL(
(select name from Person where name = 'A' and age = 100),
'not found')"
 ```

+-----------+

| not found |

+-----------+

