title: LeetCode-Trapping-Rain-Water
date: 2018-01-31 08:10:48
tags:
- 算法
- LeetCode 
---

##Problem Description
Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it is able to trap after raining.

For example, 
Given [0,1,0,2,1,0,1,3,2,1,2,1], return 6.

** problem link: **
https://leetcode.com/problems/trapping-rain-water

![](/img/LeetCode_Trapping_Rain_Water.jpg)

##Solution
```java
public class TrappingRainWater_42 {
    public int trap(int[] height) {
        int a = 0;
        int b = height.length - 1;
        int max = 0;
        int leftMax = 0;
        int rightMax = 0;
        while (a <= b) {
            leftMax = Math.max(leftMax, height[a]);
            rightMax = Math.max(rightMax, height[b]);
            if (leftMax < rightMax) {
                // leftMax is smaller than rightMax, so the (leftMax-A[a]) water can be stored
                max += (leftMax - height[a]);
                a++;
            } else {
                max += (rightMax - height[b]);
                b--;
            }
        }
        return max;
    }
}
```

##算法解释
对任意位置 i，在 i 上的积水，由左右两边最高的 bar 决定。