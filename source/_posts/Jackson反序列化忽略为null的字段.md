title: Jackson反序列化忽略为null的字段
date: 2017-08-19 23:02:30
tags: java
---
#要解决的问题
json 反序列化 bean 时，当某个字段在 json 中为 null 时，使用 bean 中声明的默认值。

Person 类我们改造下：
```
public class Person {
  private String name;
  // Address is a enum: {CH, US, GZ}
  private Region region = Region.GZ;
}
```
仍然以 Person 类举例，如果 json 串是：
```
{"name":"robert", "region":null}
```
希望反序列化后的 bean 为 
```
Person(name="robert", region=Region.GZ)
```

#解决过程
在上一篇文章 `lombok 的 AllArgs 导致 Jackson 反序列化丢失字段默认值` 中可以看到 json 反序列化为 bean 的过程，一般情况下，是先调用默认构造函数生成 bean，然后根据 json 中出现的字段挨个赋值。
所以反序列化生成的 bean 的 region 肯定为 null。

#解决方案
##1. @JsonInclude(Include.NON_NULL) 可行吗？
不可行，这个注解是序列化时忽略 null 值，反序列化时不生效，基本上反序列化时我们不能做什么事情。

##2. JsonCreator 可行吗？
在 Region 枚举里写 JsonCreator:
```
@JsonCreator
public static Region getRegion(String value) {
    for (Region region : Region.values()) {
        if (region.name().equals(value)) {
            return region;
        }
    }

    return Region.GZ;
}
```

直接将 `{"region": null}` 反序列化为 Region 是可行的，会调用 JsonCreator，但是如果是反序列化 Person 则不会调用到 JsonCreator，为什么呢？

debug 过程：
如前文所述，会调用到 `com.fasterxml.jackson.databind.deser.BeanDeserializer#deserialize` 这个函数中，然后会调用到
`com.fasterxml.jackson.databind.deser.SettableBeanProperty#deserialize`，这个函数的实现是：
```
public final Object deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
    JsonToken t = p.getCurrentToken();

    if (t == JsonToken.VALUE_NULL) {
        return _valueDeserializer.getNullValue(ctxt);
    }
    if (_valueTypeDeserializer != null) {
        return _valueDeserializer.deserializeWithType(p, ctxt, _valueTypeDeserializer);
    }
    return _valueDeserializer.deserialize(p, ctxt);
}
```

所以在这里会把 null 值拦住，直接返回 getNullValue 的结果。

##3.自定义 deserializer

实现如下：
```
public class RegionDeserializer extends JsonDeserializer<Region> {
    @Override
    public Region deserialize(JsonParser jsonParser, DeserializationContext deserializationContext)
            throws IOException {
        JsonNode node = jsonParser.getCodec().readTree(jsonParser);
        Region region = Region.GZ;

        try {
            if (StringUtils.isNotEmpty(node.textValue())) {
                return Region.getRegion(node.textValue());
            }
        } catch (Exception e) {
            type = Region.GZ;
        }

        return region;
    }

    @Override
    public Region getNullValue(DeserializationContext ctxt) {
        return Region.GZ;
    }
}
```

Person 类改为：
```
public class Person {
  private String name;
  
  // Address is a enum: {CH, US, GZ}
  @JsonDeserialize(using = RegionDeserializer.class)
  private Region region = Region.GZ;
}
```

这样，在`com.fasterxml.jackson.databind.deser.SettableBeanProperty#deserialize`这个方法里，碰到 null 值，就会返回 getNullValue 的结果，即 Region.GZ，如果不是 null 会进入 getRegion 函数处理，也能处理其他情况。

