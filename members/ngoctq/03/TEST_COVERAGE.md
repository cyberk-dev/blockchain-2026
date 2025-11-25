# Test Cases Coverage - Progressive Pricing

## Tóm tắt các test cases về tính giá

### 1. **Giá cố định (slope = 0)** - Default behavior
- ✅ Mua 1 token: 0.1 ETH
- ✅ Mua 10 tokens: 1.0 ETH (0.1 × 10)
- ✅ Mua nhiều lần: giá không đổi

**Test cases:**
- "Buy token"
- "Should mint correct amount of tokens when buying"
- "Should allow buying exact amount with exact payment"
- "Should handle multiple purchases from same buyer"

---

### 2. **Giá tăng dần (slope = 0.00001 ETH)** - Progressive pricing

#### Test Case 1: Mua 1 token đầu tiên
- **Scenario:** S = 0 (chưa bán token nào), mua N = 1 token
- **Formula:** `Sum = (1 * (0 + 0.00001*2 + 0.2)) / 2 = 0.10001 ETH`
- **Expected:** 0.10001 ETH
- ✅ **Test:** "Should calculate correct cost with progressive pricing"

#### Test Case 2: Mua 10 tokens từ đầu
- **Scenario:** S = 0 (chưa bán token nào), mua N = 10 tokens
- **Formula:** `Sum = (10 * (0 + 0.00001*11 + 0.2)) / 2 = 1.00055 ETH`
- **Expected:** 1.00055 ETH
- ✅ **Test:** "Should calculate correct cost with progressive pricing"

#### Test Case 3: Mua 1 token, sau đó mua thêm 10 tokens
- **First purchase:** S = 0, N = 1 → 0.10001 ETH
- **Second purchase:** S = 1, N = 10
  - **Formula:** `Sum = (10 * (2*0.00001*1 + 0.00001*11 + 0.2)) / 2 = 1.00065 ETH`
  - **Expected:** 1.00065 ETH
- ✅ **Test:** "Should calculate correct cost when buying 1 token first, then 10 more tokens"

#### Test Case 4: Mua 5 tokens, sau đó mua thêm 3 tokens
- **First purchase:** S = 0, N = 5 → 0.50015 ETH
- **Second purchase:** S = 5, N = 3 → 0.30021 ETH
- **Total:** 8 tokens
- ✅ **Test:** "Should handle progressive pricing correctly across multiple purchases"

---

## Chi tiết công thức

### Công thức tổng quát
```
Sum = (N * (2*a*S + a*(N+1) + 2*b)) / 2
```

Trong đó:
- **S** = totalSold (số token đã bán)
- **N** = amount (số token muốn mua)
- **a** = slope (hệ số tăng giá)
- **b** = basePrice (giá khởi điểm)

### Giải thích
Giá của token thứ i là: `price(i) = a*i + b`

Khi mua N tokens từ vị trí S+1 đến S+N:
```
Total = Σ(i=S+1 to S+N) [a*i + b]
      = (N * (2*a*S + a*(N+1) + 2*b)) / 2
```

---

## Bảng giá ví dụ (slope = 0.00001 ETH, basePrice = 0.1 ETH)

| Token # | Giá đơn lẻ (ETH) | Tích lũy (ETH) |
|---------|------------------|----------------|
| 1       | 0.10001          | 0.10001        |
| 2       | 0.10002          | 0.20003        |
| 3       | 0.10003          | 0.30006        |
| 4       | 0.10004          | 0.40010        |
| 5       | 0.10005          | 0.50015        |
| 6       | 0.10006          | 0.60021        |
| 7       | 0.10007          | 0.70028        |
| 8       | 0.10008          | 0.80036        |
| 9       | 0.10009          | 0.90045        |
| 10      | 0.10010          | 1.00055        |
| 11      | 0.10011          | 1.10066        |

---

## Kết luận

✅ **Tất cả các trường hợp đã được test:**
1. Mua token đầu tiên (S=0, N=1)
2. Mua nhiều tokens từ đầu (S=0, N=10)
3. Mua 1 token trước, sau đó mua thêm 10 tokens (S=1, N=10)
4. Mua nhiều lần với số lượng khác nhau (S=0→5→8)
5. Giá cố định (slope=0)
6. Refund khi trả thừa tiền
7. Edge cases (mua 0 tokens)

**Tổng số test cases: 25** ✅
