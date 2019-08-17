title: Spring注入
date: 2015-08-08 15:24:18
tags: Spring
---

##1. 设值注入（推荐）##
```
<bean id="myService" class="com.zane.test.MyServiceImpl">
    <property name="serializer" ref="Serializer"/>
    <property name="httpService" ref="httpService"/>
</bean>
```

##2.  构造器注入（死的应用）##
```
<bean id="myModel" class="com.zane.test.MyModel">
    <constructor-arg index="0" value="${name}"/>
    <constructor-arg index="1" value=“20"/>
</bean>
```

##3. 注入List##
```
<bean id="myTypes" class="java.util.ArrayList">
    <constructor-arg>
        <list>
            <value type="com.zane.test.MyType">A</value>
            <value type="com.zane.test.MyType">B</value>
            <value type="com.zane.test.MyType">C</value>
        </list>
    </constructor-arg>
</bean>
```

##4. 注入Map##

```
<bean id="myTypeValueMap" class="java.util.HashMap">
    <constructor-arg>
        <map>
            <entry key="#{T(com.zane.test.MyType).A}">
                <value type="java.lang.Integer">3</value>
            </entry>
            <entry key="#{T(com.zane.test.MyType).B}">
                <value type="java.lang.Integer">4</value>
            </entry>
            <entry key="#{T(com.zane.test.MyType).C}">
                <value type="java.lang.Integer">5</value>
            </entry>
        </map>
    </constructor-arg>
</bean>
```

**当注入的是第三方的jar包的key类型时，需要使用@Resource注入**

```
@Resource
@Qualifier("myTypeValueMap")
private Map<MyType, String> myTypeValueMap;
```

否则使用Autowired即可

```
@Autowired
@Qualifier("myTypeValueMap")
private Map<MyType, String> myTypeValueMap;
```