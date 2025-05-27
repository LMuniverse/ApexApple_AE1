/***********************************

> ScriptName        fimo解锁会员
> Author            @nebuluxe
> TgChannel         https://t.me/nebuluxe
> Contribute        https://t.me/lmyz_star
> UpdateTime        2023-04-13
> ScriptURL         https://github.com/LMuniverse/ApexApple_AE1/raw/main/scripts/FimoProCrack.js

[rewrite_local]

^https?:\/\/server\.zbisq\.com\/fimo-user url script-response-body https://github.com/LMuniverse/ApexApple_AE1/raw/main/scripts/FimoProCrack.js

[mitm] 

hostname = server.zbisq.com

***********************************/




var obj=JSON.parse($response.body);obj.subscribe={valid:!0,forever:1,endTime:4092599349},$done({body:JSON.stringify(obj)});