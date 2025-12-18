1. Tạo thanh khoản:
- 10 PEPE (ERC20)
- 4000 USDT (ERC20)
=> k = 10 * 4000 = 40000
- lượng LP được mint ở thời điểm đầu dựa vào Max(PEPE, USDT)

2. Formula mua bán
x * y = k

mua x: (x - d_x) * (y + d_y) = k
        x*y + x*d_y - d_x*y - d_x*d_y = k
        x*d_y - d_x*d_y = k - x*y + d_x*y
        d_y = d_x*y / (x - d_x)
bán x: (x + d_x) * (y - d_y) = k
        x*y - x*d_y - d_x*y + d_x*d_y = k
        -x*d_y + d_x*d_y = k - x*y - d_x*y
        d_y = d_x*y / (x + d_x)

- slipage: là cost d_y tối đa muốn bỏ ra để mua d_x
  - d_y = caculated_d_y * (1 + slipage)

- buy_exact_in: d_x cố định
- buy_exact_out: d_y cố định
- sell_exact_in: d_x cố định
- sell_exact_out: d_y cố định

3. Fee:
- 0.3%
- real_d_y = d_y * 1.03% (mua)
- real_d_x = d_x * 0.97% (0.3% fee)

4. Cung cấp thanh khoản: (add LP)
- 10WPEPE/1000USDT
- DucCOOK: +20PEPE/2000USDT => 30PEPE/3000USDT

5. Rút thanh khoản: (remove LP)

-----------------

Contract structure:
- LPFactory -> tạo LPToken
- LPToken -> add/remove LP, swap_exact_*