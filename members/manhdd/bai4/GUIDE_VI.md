# Hướng Dẫn Bài 4: Bonding Curve (Tiếng Việt)

## Phần 1: Nền Tảng Toán Học

### 1.1 Bonding Curve là gì?

Bonding Curve là một **hàm số** xác định giá của token dựa trên **số lượng token đã bán**.

```
Bán càng nhiều token => Giá càng cao
```

Đây là cơ chế để:
- Token đầu tiên rẻ (thưởng cho người mua sớm)
- Token sau đắt hơn (người mua trễ phải trả nhiều hơn)

### 1.2 Công Thức Tuyến Tính: y = ax + b

```
y = ax + b

Trong đó:
- x = vị trí của token (token thứ 1, thứ 2, thứ 3...)
- y = giá của token tại vị trí x
- a = hệ số góc (slope) - quyết định tốc độ tăng giá
- b = giá khởi điểm (y-intercept) - giá khi x = 0
```

**Ví dụ đơn giản:**

Nếu `a = 2` và `b = 10`:
```
Token thứ 1: y = 2×1 + 10 = 12 đồng
Token thứ 2: y = 2×2 + 10 = 14 đồng
Token thứ 3: y = 2×3 + 10 = 16 đồng
Token thứ 4: y = 2×4 + 10 = 18 đồng
...
```

Như vậy, mỗi token tăng thêm 2 đồng (bằng giá trị của `a`).

---

## Phần 2: Bài Toán Tính Tổng

### 2.1 Vấn Đề

Khi người dùng mua **nhiều token cùng lúc**, ta cần tính **tổng giá** của tất cả các token đó.

**Ví dụ:** Mua 3 token đầu tiên (token 1, 2, 3)

```
Tổng giá = giá(1) + giá(2) + giá(3)
         = (2×1 + 10) + (2×2 + 10) + (2×3 + 10)
         = 12 + 14 + 16
         = 42 đồng
```

### 2.2 Ký Hiệu Toán Học: Sigma (Tổng)

Thay vì cộng từng cái, ta dùng ký hiệu **Sigma** (tổng):

```
        s+m
Cost =  Σ   (ax + b)
       x=s+1

Trong đó:
- s = số token đã bán trước đó (current supply)
- m = số token muốn mua
- x chạy từ (s+1) đến (s+m)
```

**Ví dụ cụ thể:**

Đã bán 5 token (s=5), muốn mua thêm 3 token (m=3):
```
        8
Cost =  Σ  (2x + 10)
       x=6

     = (2×6 + 10) + (2×7 + 10) + (2×8 + 10)
     = 22 + 24 + 26
     = 72 đồng
```

### 2.3 Công Thức Tổng Quát (Closed-Form)

Việc cộng từng token như trên rất chậm. Máy tính phải lặp m lần.
Nếu m = 1,000,000 thì phải lặp 1 triệu lần => tốn gas!

**Giải pháp:** Dùng công thức toán học để tính trực tiếp.

#### Bước 1: Tách tổng

```
  s+m                    s+m           s+m
  Σ   (ax + b)    =   a× Σ(x)    +    Σ(b)
 x=s+1                  x=s+1         x=s+1
```

#### Bước 2: Tính Σ(b)

`b` là hằng số, lặp m lần:
```
  s+m
  Σ(b) = b + b + b + ... (m lần) = b × m
 x=s+1
```

#### Bước 3: Tính Σ(x) từ s+1 đến s+m

Đây là tổng của dãy số học (arithmetic series):
```
(s+1) + (s+2) + (s+3) + ... + (s+m)
```

**Công thức tổng dãy số học:**
```
Tổng = (số_phần_tử) × (số_đầu + số_cuối) / 2
     = m × ((s+1) + (s+m)) / 2
     = m × (2s + m + 1) / 2
```

#### Bước 4: Kết hợp lại

```
Cost = a × [m × (2s + m + 1) / 2] + b × m

     = (a × m × (2s + m + 1)) / 2 + b × m
```

**Đây chính là CÔNG THỨC 1 DÒNG cần tìm!**

---

## Phần 3: Kiểm Chứng Bằng Số

### 3.1 Ví Dụ 1: Mua 3 token đầu tiên

Cho: a=2, b=10, s=0, m=3

**Cách 1: Tính từng cái**
```
Cost = (2×1+10) + (2×2+10) + (2×3+10)
     = 12 + 14 + 16
     = 42
```

**Cách 2: Dùng công thức**
```
Cost = (a × m × (2s + m + 1)) / 2 + b × m
     = (2 × 3 × (2×0 + 3 + 1)) / 2 + 10 × 3
     = (2 × 3 × 4) / 2 + 30
     = 24 / 2 + 30
     = 12 + 30
     = 42  ✓ KHỚP!
```

### 3.2 Ví Dụ 2: Mua token 6, 7, 8 (đã bán 5 token)

Cho: a=2, b=10, s=5, m=3

**Cách 1: Tính từng cái**
```
Cost = (2×6+10) + (2×7+10) + (2×8+10)
     = 22 + 24 + 26
     = 72
```

**Cách 2: Dùng công thức**
```
Cost = (2 × 3 × (2×5 + 3 + 1)) / 2 + 10 × 3
     = (2 × 3 × 14) / 2 + 30
     = 84 / 2 + 30
     = 42 + 30
     = 72  ✓ KHỚP!
```

---

## Phần 4: Áp Dụng Vào Solidity

### 4.1 Vấn Đề Decimal

Trong Solidity, **KHÔNG CÓ SỐ THẬP PHÂN** (floating point).

```solidity
5 / 2 = 2    // KHÔNG PHẢI 2.5!
1 / 2 = 0    // KHÔNG PHẢI 0.5!
7 / 3 = 2    // KHÔNG PHẢI 2.333...!
```

### 4.2 Giải Pháp: Dùng Số Nguyên Lớn

Thay vì:
```
a = 0.0000000000000000000001  (quá nhỏ, không thể biểu diễn)
```

Ta dùng:
```
a_numerator = 1
PRECISION = 10^22

a thực tế = a_numerator / PRECISION = 1 / 10^22
```

### 4.3 Tại Sao 18 Decimals?

ERC20 token mặc định dùng 18 decimals:
```
1 TOKEN = 1,000,000,000,000,000,000 đơn vị nhỏ nhất (10^18)
        = 1e18

0.5 TOKEN = 500,000,000,000,000,000 đơn vị (5e17)
```

Tương tự ETH:
```
1 ETH = 10^18 wei
0.1 ETH = 10^17 wei
0.00005 ETH = 5 × 10^13 wei
```

### 4.4 Bonding Curve Áp Dụng Cho Đơn Vị Nhỏ Nhất

**QUAN TRỌNG:** Công thức `y = ax + b` áp dụng cho **TỪNG ĐƠN VỊ NHỎ NHẤT**, không phải "1 token".

```
Khi bạn "mua 1 token", thực ra bạn đang mua 10^18 đơn vị nhỏ nhất.
Mỗi đơn vị có giá riêng theo công thức.
```

Ví dụ với a=1, b=12, PRECISION=10^22:
```
Đơn vị thứ 1:            giá = (1×1 + 12) / 10^22 = 13e-22 ETH
Đơn vị thứ 2:            giá = (1×2 + 12) / 10^22 = 14e-22 ETH
...
Đơn vị thứ 10^18:        giá = (1×10^18 + 12) / 10^22 ≈ 10^-4 ETH
```

---

## Phần 5: Công Thức Cuối Cùng Trong Solidity

### 5.1 Công Thức Toán Học

```
Cost = (a × m × (2s + m + 1)) / 2 + b × m

Tất cả chia cho PRECISION (10^22)
```

### 5.2 Chuyển Sang Solidity

```solidity
function getCost(uint256 s, uint256 m, uint256 _a, uint256 _b) public pure returns (uint256) {
    // Term 1: (a × m × (2s + m + 1)) / (2 × PRECISION)
    // Term 2: (b × m) / PRECISION

    return FullMath.mulDiv(_a * m, 2 * s + m + 1, 2 * PRECISION)
         + FullMath.mulDiv(_b, m, PRECISION);
}
```

### 5.3 Tại Sao Dùng FullMath.mulDiv?

`mulDiv(a, b, c)` tính `(a × b) / c` với:
- Độ chính xác 512-bit (không bị overflow)
- Chia chính xác (không mất precision)

**Vấn đề nếu không dùng:**
```solidity
// NGUY HIỂM - có thể overflow!
uint256 result = (a * m * (2 * s + m + 1)) / (2 * PRECISION);

// Nếu a=1, m=10^18, s=10^27:
// a × m × (2s + m + 1) = 1 × 10^18 × 2×10^27 = 2 × 10^45
// uint256 max = 2^256 ≈ 10^77, nên không overflow
// NHƯNG nếu a lớn hơn thì sẽ overflow!
```

**An toàn với mulDiv:**
```solidity
// AN TOÀN - sử dụng 512-bit intermediate
FullMath.mulDiv(_a * m, 2 * s + m + 1, 2 * PRECISION)
```

---

## Phần 6: Kiểm Tra Với Wolfram Alpha

### 6.1 Link Wolfram Cho Token Đầu Tiên

Mua 1 token (10^18 đơn vị) từ supply 0:

```
Sum[x/10^22 + 12/10^22, {x, 1, 10^18}]
```

Link: https://www.wolframalpha.com/input?i2d=true&i=Sum%5BDivide%5Bx%2C1e22%5D+%2B+Divide%5B12%2C1e22%5D%2C%7Bx%2C1%2C1e18%7D%5D

**Kết quả Wolfram:** Khoảng 5.0000000000006×10^13 wei ≈ 0.00005 ETH

### 6.2 Xác Minh Bằng Công Thức

```
s = 0, m = 10^18, a = 1, b = 12, PRECISION = 10^22

Cost = (1 × 10^18 × (0 + 10^18 + 1)) / (2 × 10^22) + (12 × 10^18) / 10^22

Term1 = (10^18 × (10^18 + 1)) / (2 × 10^22)
      ≈ 10^36 / (2 × 10^22)
      = 5 × 10^13

Term2 = 12 × 10^18 / 10^22
      = 12 × 10^-4
      = 0.0012 × 10^18
      = 1.2 × 10^15

Total = 5 × 10^13 + 1.2 × 10^15
      ≈ 1.25 × 10^15 wei
      ≈ 0.00125 ETH
```

**Lưu ý:** Giá trị chính xác lấy từ Wolfram để test!

### 6.3 Link Wolfram Cho 10 Token Tiếp Theo

Mua 10 token (10 × 10^18 đơn vị) từ supply 10^18:

```
Sum[x/10^22 + 12/10^22, {x, 10^18 + 1, 11 × 10^18}]
```

---

## Phần 7: Lỗi Trong Bài 3 Của Bạn

### 7.1 Lỗi 1: Chia Cho Decimals

```solidity
// SAI - mất precision!
uint256 N = _amount / unit;  // unit = 10^18
```

Bạn đang chuyển từ "đơn vị nhỏ nhất" sang "token nguyên".
Điều này làm mất thông tin và sai về mặt toán học.

**Bonding curve phải áp dụng cho từng đơn vị nhỏ nhất!**

### 7.2 Lỗi 2: Công Thức Quá Phức Tạp

```solidity
// Quá nhiều dòng, khó kiểm tra
uint256 sum1 = FullMath.mulDiv(SN, SN + 1, 2);
uint256 sum2 = FullMath.mulDiv(S, S + 1, 2);
uint256 sumK = sum1 - sum2;
uint256 costA = FullMath.mulDiv(a, sumK, 1);
uint256 costB = FullMath.mulDiv(b, N, 1);
uint256 totalCost = costA + costB;
```

**Cách đúng:** 1 dòng duy nhất
```solidity
return FullMath.mulDiv(_a * m, 2 * s + m + 1, 2 * PRECISION)
     + FullMath.mulDiv(_b, m, PRECISION);
```

---

## Phần 8: Tổng Kết

### Công Thức Toán Học:
```
         s+m
Cost =   Σ   (ax + b)  =  (a × m × (2s + m + 1)) / 2 + b × m
        x=s+1
```

### Công Thức Solidity:
```solidity
function getCost(uint256 s, uint256 m, uint256 _a, uint256 _b) public pure returns (uint256) {
    return FullMath.mulDiv(_a * m, 2 * s + m + 1, 2 * PRECISION)
         + FullMath.mulDiv(_b, m, PRECISION);
}
```

### Các Biến:
- `s` = totalSupply() - số token đã mint
- `m` = _amount - số token muốn mua
- `_a` = 1 (hệ số góc)
- `_b` = 12 (giá khởi điểm)
- `PRECISION` = 10^22

### Best Practice:
1. Luôn kiểm tra công thức với Wolfram Alpha
2. Dùng FullMath để tránh overflow
3. Làm việc với đơn vị nhỏ nhất, không chia cho decimals
4. Viết test so sánh với giá trị Wolfram

---

## Phần 9: Bài Tập Tự Làm

1. Tính tay giá của 5 token đầu tiên (với a=1, b=12, PRECISION=10^22)
2. Kiểm tra lại bằng Wolfram Alpha
3. Implement getCost() trong Solidity
4. Viết test so sánh kết quả

Chúc bạn thành công!
