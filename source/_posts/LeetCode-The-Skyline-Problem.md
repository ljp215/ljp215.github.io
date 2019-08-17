title: LeetCode - The Skyline Problem
date: 2016-03-26 22:47:52
tags: 
- 算法
- LeetCode 
---
##Problem Description
A city's skyline is the outer contour of the silhouette formed by all the buildings in that city when viewed from a distance. Now suppose you are given the locations and height of all the buildings as shown on a cityscape photo (Figure A), write a program to output the skyline formed by these buildings collectively (Figure B).

 Buildings  Skyline Contour
The geometric information of each building is represented by a triplet of integers [Li, Ri, Hi], where Li and Ri are the x coordinates of the left and right edge of the ith building, respectively, and Hi is its height. It is guaranteed that 0 ≤ Li, Ri ≤ INT_MAX, 0 < Hi ≤ INT_MAX, and Ri - Li > 0. You may assume all buildings are perfect rectangles grounded on an absolutely flat surface at height 0.

For instance, the dimensions of all buildings in Figure A are recorded as: [ [2 9 10], [3 7 15], [5 12 12], [15 20 10], [19 24 8] ] .

The output is a list of "key points" (red dots in Figure B) in the format of [ [x1,y1], [x2, y2], [x3, y3], ... ] that uniquely defines a skyline. A key point is the left endpoint of a horizontal line segment. Note that the last key point, where the rightmost building ends, is merely used to mark the termination of the skyline, and always has zero height. Also, the ground in between any two adjacent buildings should be considered part of the skyline contour.

For instance, the skyline in Figure B should be represented as:[ [2 10], [3 15], [7 12], [12 0], [15 10], [20 8], [24, 0] ].

Notes:
- The number of buildings in any input list is guaranteed to be in the range [0, 10000].
- The input list is already sorted in ascending order by the left x position Li.
- The output list must be sorted by the x position.
There must be no consecutive horizontal lines of equal height in the output skyline. For instance, [...[2 3], [4 5], [7 5], [11 5], [12 7]...] is not acceptable; the three lines of height 5 should be merged into one in the final output as such: [...[2 3], [4 5], [12 7], ...]

**problem link:** 
https://leetcode.com/problems/the-skyline-problem/

##Solution

```
public class TheSkylineProblem_218 {
    public List<int[]> getSkylineSimpleSolution(int[][] buildings) {
        List<int[]> result = new ArrayList<>();
        List<int[]> height = new ArrayList<>();

        // height < 0: the height of building started
        // height > 0: the height of building ended
        for (int[] b : buildings) {
            height.add(new int[]{b[0], -b[2]});
            height.add(new int[]{b[1], b[2]});
        }

        // sorted by x value, if x equals then sorted by y value
        Collections.sort(height, (a, b) -> {
            if (a[0] != b[0])
                return a[0] - b[0];
            return a[1] - b[1];
        });

        // record the height of visited buildings by reverse order
        Queue<Integer> pq = new PriorityQueue<>((a, b) -> (b - a));
        pq.offer(0);

        int prevHeight = 0;
        for (int[] h : height) {
            if (h[1] < 0) {
                // save the height of building
                pq.offer(-h[1]);
            } else {
                // remove the height of building
                pq.remove(h[1]);
            }

            int curHeight = pq.peek();

            if (prevHeight != curHeight) {
                // find the turn point
                result.add(new int[]{h[0], curHeight});
                prevHeight = curHeight;
            }
        }
        return result;
    }
}
```

##算法解释
###算法思路
1. 遍历所有的点，height用来存放每个顶点，左顶点的高度转为负数，右顶点的高度仍然是正数
2. 对height数组排序，首先按x的值排序，当x的值相等时按z排序，这样保证了即使矩形的起点一样，也是最先处理最高的点。对于[{1,2,1},{1,2,2},{1,2,3}]这样的情况会优先处理{1,2,3}这个点。
3. 使用优先级队列pq来保存当前最近buildings的高度，这个结构很重要！
4. 遍历height数组，碰到左顶点时，将高度放入pq中，否则，碰到右顶点时则将高度从pq从移除。这样做的好处是，每次走完一个矩形时，高度能回归到之前的buildings的高度。
5. 获取当前的最高高度，因为如果比当前矮的话，是不需要放入拐点中的，这点很重要！
6. 如果当前的最高高度和之前的高度不一致，说明出现了拐点。**如果当前的最高高度矮于之前的值，说明之前的很高的建筑遇到了它的右顶点从而被移除了，所以目前的最高高度即使矮于之前的点，但是是新的隔离的building了，所以可以加入。那么如果高呢？当前高度比之前高，那肯定会是拐点了。

##总结
几个关键点：
1. 对顶点进行排序保存，对左右顶点根据正负号来加以区分
2. 使用一个优先级队列来保存目前最高的建筑
3. 碰到右顶点时消除目前的建筑高度
4. 根据之前的高度和处理目前顶点以后(可能是加入了高度也可能是消除了之前的高度)的高度，对两者进行比较来找到拐点

##Reference
> https://leetcode.com/discuss/54201/short-java-solution