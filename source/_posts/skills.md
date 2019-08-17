title: skills
date: 2016-01-03 12:28:17
tags: 调试
---

### 将数据转成json格式：python -m json.tool

	$ echo '{"json":"obj"}' | python -m json.tool
	{
	"json": "obj"
	}

### 查看gzip数据
使用python的zlib库来解压

	s='\x1F\x8B\x08\x00\x00\x00\x00\x00\x00\x005N\xCD\x0A\xC3 \x18{\x97\xEF,\xE5s\xF3gz\xAB\xA0/1z\x18\xC31\x87m\xA5\xEA\xA1\x94\xBE\xFB\xBE\xC3vJHB\x92\x03z\x8D\xDBXJ\x05{?\xA0,`\xE1\xB9\xCEC\xEB\x9F\xF4\x18\xDEk\x8B\x19\x18\xD4\x99d\xC9/\xCE\xF9\x10Ft\xE1\xAA\x9DFm\x8C\x92B)w\xF3\x02\xBD\xA1\x5C\xA3\x16.\x84\xE4\x5CHD\x94\x82Ao`\x97\x9E3\x83Df\xDBzdP\xD2_{\x11C\x06\xB9\x13\x9C\x13\x0D\xED\xF5\xF7e:\xBF\xAB \xDB\x10\x9B\x00\x00\x00' 

	import zlib
	d=zlib.decompressobj(16+zlib.MAX_WBITS) 
	data=d.decompress(s)

### 统计服务器上的历史登录记录
	last -ad | awk '{print $1}' | sort | uniq -c | sort -t$'\t' -k1,1 -nr 

### linux文件格式转换
在linux下，不可避免的会用VIM打开一些windows下编辑过的文本文件。我们会发现文件的每行结尾都会有一个^M符号，这是因为DOS下的编辑器和Linux编辑器对文件行末的回车符处理不一致， 
对于回车符的定义： 
- windows：0D0A 
- unix\linux: 0A 
- MAC: 0D 
去除这些符号的方法有： 
- vim下 ` :set fileformat=unix `
- 终端  `dos2unix filename `

### git图形化提交历史
	git log --pretty=format:"%h %an %s" --graph


### echo 总结 
1. echo默认是带换行符做结尾的
2. echo -n 可以去掉换行符
3. printf是没有换行符结尾的
4. tr可以删掉一个字符，如 tr -d '\n' 

### 删除空行
1. grep: grep -v '^$' file
2. sed: sed '/^$/d'  file 或 sed -n '/./p' file
3. awk: awk '/./ {print}' file

### shell读文件
读取 md5s 文件，对每行做处理。

	cat md5s | while read line 
	do 
	     md5=$line 
	     level2Path=`expr substr "$md5" 30 2` #50 
	     level1Path=`expr substr "$md5" 32 1` #a 
	     storagePath=hdfs:///ljp/apk/path/$level1Path/$level2Path/$md5 
	     echo $storagePath
	done 



