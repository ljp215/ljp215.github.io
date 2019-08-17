title: Shell常用技巧
date: 2015-04-10 11:43:31
tags: shell
---

####grep常用技巧

grep匹配TAB

```
直接grep tab字符 //命令行下用”ESC TAB”输入
grep $'\t'
```

grep匹配减号

```
cat file | grep -- -1 
```

去除所有空行

```
cat file | grep -v "^$" > file2
```

只显示以a开头的行。

```
cat file | grep '^a'
```

显示log中error附近的内容

```
cat file | grep -C5 "error"
```

<br />
####awk常用技巧

隔行显示

```
cat file | awk '{getline; print $1;}' 
```

取奇数/偶数行数据

```
awk 'NR%2==1' file  //显示奇数行
awk 'NR%2==0' file  //显示偶数行
```

<br />
####vim常用技巧

vim下将x替换成制表符

```
%s/x/^I
p.s: 直接按TAB就可以啦 ,不需要用转义序列\t的
```

vim下将x替换成换行

```
%s/x/\r
```

<br />
####sed常用技巧

查看文件选定的行

```
wc -l  a.txt  //统计a.txt 行数
sed -n '190,196p' a.txt //查看第190行到第196行
sed -n '190,1p' a.txt //查看第190行
```

将文件中的 , 换成 tab 符号
```
cat data.csv | sed $'s/,/\t/g'
```




