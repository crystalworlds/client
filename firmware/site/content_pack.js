/* ===========================================================================
   firmware/site/content_pack.js  —  in-browser "content pack" loader
   ---------------------------------------------------------------------------
   Lets a user open ONE .zip of their own dumps + segment-artwork SVGs +
   colour-unit flash images, and identifies + loads everything the SAME way
   firmware/scripts/lib/build_nintendo.ps1 does, but entirely in the browser:

     • classic firmware / melodies  — by SHA-256 content hash (with the same
                                    truncation fallback for zero-padded dumps),
     • segment artwork SVGs      — by SHA-256 whole-file hash → svgPath,
     • Pokemon mini + Game Boy   — by whole-file SHA-256 + size, filed under the
                                    catalogue's own device ids,
     • colour-unit (TFT) flash   — by exact size + pairing (131072 internal
                                    plus 1048576→mario / 4194304→zelda), grouped
                                    per archive/folder so both units in one zip
                                    stay separate.

   The result is stored in IndexedDB, so it persists across reloads/visits until
   the user clears it. NOTHING sensitive ships in this file — only the very same
   hash/size manifest the PowerShell builder embeds (no firmware/flash/art bytes).

   It's an ALTERNATIVE to running the builder: if the pre-built JSON/JS content
   files are installed they win; otherwise gnw.js and the TFT twin
   fall back to whatever this pack holds.  Zero external libraries — the zip is
   read with the browser's own DecompressionStream + a small directory parser.
   =========================================================================== */
(function () {
  'use strict';

  // --- identity manifest (hashes + sizes only, generated from the builder) ----
  var GNW_MANIFEST = [
{"sha256":"1b1bb844c4bb0481a87e6c114a438b2d4e308c1581f4e7dd7dfa7ff8222d1cfd","bytes":1856,"device":"ball","part":"program"},
{"sha256":"1b1bb844c4bb0481a87e6c114a438b2d4e308c1581f4e7dd7dfa7ff8222d1cfd","bytes":1856,"device":"ballreissue","part":"program"},
{"sha256":"38bfbb54eedb3761804d6e659da76e2c2dc0f916606ca081a6f0854c15aaba05","bytes":4096,"device":"bfight","part":"program"},
{"sha256":"7f17e2032b8a0037d51f91aa0900f8c0e28d9a5e4e89c96ada1a893dcbc7ef2b","bytes":256,"device":"bfight","part":"melody"},
{"sha256":"38bfbb54eedb3761804d6e659da76e2c2dc0f916606ca081a6f0854c15aaba05","bytes":4096,"device":"bfightn","part":"program"},
{"sha256":"7f17e2032b8a0037d51f91aa0900f8c0e28d9a5e4e89c96ada1a893dcbc7ef2b","bytes":256,"device":"bfightn","part":"melody"},
{"sha256":"3863a70f01819db79155f99eefb90219a01fe689d6940d02121bba60656f8d6c","bytes":4096,"device":"bjack","part":"program"},
{"sha256":"771d34cd866ea5af60cbdf642f58844cbdb8621e5fbc37976aeeeb9933974f78","bytes":256,"device":"bjack","part":"melody"},
{"sha256":"4f559e796947bb11d3a8b5636669c5674c3aa4f75a05b7c343ae829601e031a1","bytes":4096,"device":"bombsweep","part":"program"},
{"sha256":"3c45f3d0c049272344139d143b13a4e2ddbd213263062d8e1a1e682233b1636d","bytes":256,"device":"bombsweep","part":"melody"},
{"sha256":"927b582f26ee72230b4448867444bb800b259d1d1f16d7dce19e7adce16bd7a2","bytes":4096,"device":"boxing","part":"program"},
{"sha256":"6e4736ebada050955f2f75ceeff85be744049510623ef6dc4286e37b411499ea","bytes":256,"device":"boxing","part":"melody"},
{"sha256":"9bcaafaefe6d8cbefdcdab1d5801ed471e3ba52c44f405479c886fed094a3641","bytes":4096,"device":"cgrab","part":"program"},
{"sha256":"27fbd8bbfab1a8d7b2a484256f05e01426cf4170ffa79452c89181a620d8e20c","bytes":1856,"device":"chef","part":"program"},
{"sha256":"aa151f4a31d8f140d6905f705156ca33cda0c548ac2b179df121ac7ed13120ad","bytes":4096,"device":"climber","part":"program"},
{"sha256":"98cace3b07edacb62d989a1f258e063905f3ff99e27389d8cc5cd95f76a9d94b","bytes":256,"device":"climber","part":"melody"},
{"sha256":"aa151f4a31d8f140d6905f705156ca33cda0c548ac2b179df121ac7ed13120ad","bytes":4096,"device":"climbern","part":"program"},
{"sha256":"98cace3b07edacb62d989a1f258e063905f3ff99e27389d8cc5cd95f76a9d94b","bytes":256,"device":"climbern","part":"melody"},
{"sha256":"e9fc7e4858c48faa54ec9bf890c0f1a5a2b18c3a22d168b505d515f7c940bfe3","bytes":4096,"device":"dkcirc","part":"program"},
{"sha256":"cf90bba51dc00e01c0a168157db99b2aaf91ca83194644f8a9c7474b1d5a8430","bytes":256,"device":"dkcirc","part":"melody"},
{"sha256":"7b358188e341faf8dea9dd94717b70ae38a409eb134ec71fe00e7feca42f9778","bytes":4096,"device":"dkhockey","part":"program"},
{"sha256":"1d7d2dfbbf3ac5c05032cbf811607522b452f54bd42959dc54d5f7714cdb17ab","bytes":256,"device":"dkhockey","part":"melody"},
{"sha256":"b279a9b2b6bcdcacbd09bdae869c63a8cbf378745280a5c33593ce48abc052be","bytes":4096,"device":"dkjr","part":"program"},
{"sha256":"ccbfa247ea985d73d56b9c4bdfe9576736abc3520217047658c710645d0916e0","bytes":4096,"device":"dkjrp","part":"program"},
{"sha256":"c0b8625e7e401df44c4f7fb407000e270ed0842ff99458eafab21a90c193568e","bytes":256,"device":"dkjrp","part":"melody"},
{"sha256":"ccbfa247ea985d73d56b9c4bdfe9576736abc3520217047658c710645d0916e0","bytes":4096,"device":"dkjrt","part":"program"},
{"sha256":"c0b8625e7e401df44c4f7fb407000e270ed0842ff99458eafab21a90c193568e","bytes":256,"device":"dkjrt","part":"melody"},
{"sha256":"4112ef438bd98176e2e3f2b75a3bdcb856cdd07b297232ba7a8d992315464761","bytes":4096,"device":"dkong","part":"program"},
{"sha256":"f93e876811487a37a5275de0f4cf0ae716d885573f8c1753d836c7eb03cb5613","bytes":4096,"device":"dkong2","part":"program"},
{"sha256":"00db2b7d6060d0042358bc4d5be7e660be7e2eec6f5bb933bac8be5b2439ce56","bytes":4096,"device":"dkong3","part":"program"},
{"sha256":"b2791b378620460b8ad9795d14eb1eeaae4a52c38ff67cf1a8c3e09a218ec6f0","bytes":256,"device":"dkong3","part":"melody"},
{"sha256":"28a225536ec129f227b8d3e261e6f10012206d0404d5f5d958c60bd71773fa7d","bytes":1856,"device":"egg","part":"program"},
{"sha256":"0d955064089d66c8b0bf7a83fb36400c1630d02f24240c11759e88437682b575","bytes":1856,"device":"fire","part":"program"},
{"sha256":"7e3d50dd31ae9ef5c9b4458dbc66854b87b6db99add3aa080967f09f655e29dc","bytes":4096,"device":"fireatk","part":"program"},
{"sha256":"1005998c0be5af8491fa481d8793e62d47f47e3f9f709ef083aff9cd43950469","bytes":1856,"device":"firews","part":"program"},
{"sha256":"4d61ea391bfa1d2da46c3baf4497d7bf0f2e6e482ce910c75d2ad1b259bd2b48","bytes":1856,"device":"flagman","part":"program"},
{"sha256":"426a433e046ab437aec35283181992952e6db99cf06b4eb8d33e28e7366c6e6d","bytes":4096,"device":"gcliff","part":"program"},
{"sha256":"242b2b65aa5189b3fa6dc29b801762767e1a6e026edd3d8ace8f63a0a0bf522e","bytes":256,"device":"gcliff","part":"melody"},
{"sha256":"d0b1756bdced26372e0524230a9cb72b882c566396ee0069386cd6b65c7247f0","bytes":4096,"device":"ghouse","part":"program"},
{"sha256":"7c7aa1511ebf25964be6f2fb4e5764c37ea04ca3ff09d37b519816aa497d2058","bytes":1856,"device":"helmet","part":"program"},
{"sha256":"f92ce28f00124c1da3627a5461f06d5157d45b1067e5f15c0a36edecdce67a68","bytes":1856,"device":"judge","part":"program"},
{"sha256":"cd1160e842e83226269dfc72c51335cabfbd2e4333317c5ba2f184f6b0df321e","bytes":1856,"device":"helmet~cn07","part":"program"},
{"sha256":"7a6a931445c1af0d84e2edd100a8efdbe4d7d5f7da484de6a1ea54fad3ea3c74","bytes":1856,"device":"judge~ip15","part":"program"},
{"sha256":"c5fc5f8c8b5fa21f0aa8a6448d57c961d6e53b8afa723efe3172e2c98141f194","bytes":4096,"device":"lboat","part":"program"},
{"sha256":"16e1a9b9849ed0c5ebcf818e9ed64157528631ac110b4e649a4e339f08e99582","bytes":1856,"device":"lion","part":"program"},
{"sha256":"bf1de11e8b450de8d6bde4a864848ccff31ac13d3329734ee006dfb5d232a36d","bytes":1856,"device":"manhole","part":"program"},
{"sha256":"371cceca4dccbb6e30c9bd6f46c0a0647d6d0592dc1006b32299947931cf8998","bytes":4096,"device":"manholews","part":"program"},
{"sha256":"e11cfc69bb14c03fcb5f849ac0697e2f0fca399095db09f80ee2f9f0e18ccd4c","bytes":4096,"device":"mario","part":"program"},
{"sha256":"7aa3ba6730c53f968eb6af7efad3db2fdb99bafb020ba100fbe2454b8466672d","bytes":4096,"device":"mariocm","part":"program"},
{"sha256":"6f997b63a6ad297c8a3df9de3d4008db1ef81f5999f49c6c27c14a1d486427bc","bytes":4096,"device":"mariocmt","part":"program"},
{"sha256":"6e22de86c901f718f34f5814955e0cdcca2149f222559bb6402662b26bd626d9","bytes":256,"device":"mariocmt","part":"melody"},
{"sha256":"257aed0bb880a872b02ce237c9d7c3bf183fa65305440c3beafac73cf15b87d3","bytes":4096,"device":"mariotj","part":"program"},
{"sha256":"7b0d8a978483d5d3534c97222e6f0e2f99796776ffd15b86a3fe645d12cb574b","bytes":256,"device":"mariotj","part":"melody"},
{"sha256":"8698ee42695d6e384a3237cbba5fe2da15acffb3214f4127830434574a37b0ff","bytes":4096,"device":"mbaway","part":"program"},
{"sha256":"2657ae126ec3bf62392b5bd51061559cb1e4ec64b8a9fff56afc27c70224043c","bytes":256,"device":"mbaway","part":"melody"},
{"sha256":"273e8e4058a6b5279e4f4f82d02acba0e9a788d9b33533050460213daa83f735","bytes":4096,"device":"mickdon","part":"program"},
{"sha256":"28a225536ec129f227b8d3e261e6f10012206d0404d5f5d958c60bd71773fa7d","bytes":1856,"device":"mmouse","part":"program"},
{"sha256":"e9fc7e4858c48faa54ec9bf890c0f1a5a2b18c3a22d168b505d515f7c940bfe3","bytes":4096,"device":"mmousep","part":"program"},
{"sha256":"cf90bba51dc00e01c0a168157db99b2aaf91ca83194644f8a9c7474b1d5a8430","bytes":256,"device":"mmousep","part":"melody"},
{"sha256":"4c45f7fe4df94bc15aeab606bbe2b20a606c272d3021ed64929c3ae67dce32c3","bytes":1856,"device":"octopus","part":"program"},
{"sha256":"8e042b8e03f3a09f0c7fa4730fb2d6ce29c5265ae429993cdd7d0436758e9ef1","bytes":4096,"device":"opanic","part":"program"},
{"sha256":"13f95a9d6e1d02677267b488476e09ab2b8d179112ab9da86397731a433b1bab","bytes":1856,"device":"pchute","part":"program"},
{"sha256":"9dc1b7e3b7a7b2868127ee204849bdd92347548f75f8ca1e3c71ae58bef12138","bytes":4096,"device":"pinball","part":"program"},
{"sha256":"ec11a70e9fa7bda13562f73c623bf4799404b35c1a8fd1d5b64b517d8e10cdcb","bytes":256,"device":"pinball","part":"melody"},
{"sha256":"101981fee60fee7e0343373b19b1ae414e54eb8212e6b320e3fb6e1f3a87738f","bytes":1856,"device":"popeye","part":"program"},
{"sha256":"fb0621194a49a9c565bf883e394c71c8e1ab023a154c87b34af910cf4de5fb8e","bytes":4096,"device":"popeyep","part":"program"},
{"sha256":"6c46c57f8573bbe1c8beb46e2ae6370fa82cc393a715e1b0da9bc93c250c830e","bytes":256,"device":"popeyep","part":"melody"},
{"sha256":"fb0621194a49a9c565bf883e394c71c8e1ab023a154c87b34af910cf4de5fb8e","bytes":4096,"device":"popeyet","part":"program"},
{"sha256":"6c46c57f8573bbe1c8beb46e2ae6370fa82cc393a715e1b0da9bc93c250c830e","bytes":256,"device":"popeyet","part":"melody"},
{"sha256":"78bdee56533b5dfa4a031b5c14ae3614e3fa113642c86d1a96e628e1d8990ba5","bytes":4096,"device":"rshower","part":"program"},
{"sha256":"254d103f04eac2352a2697561e15b60f0e2b8a4b78bcdeae32bd6990a788f3ab","bytes":4096,"device":"sbuster","part":"program"},
{"sha256":"eac894385cc9523cf1fc5816ba03931e9847c613f0bd693abb61cce26d066135","bytes":256,"device":"sbuster","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smb","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smb","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smbn","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smbn","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smbspecial","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smbspecial","part":"melody"},
{"sha256":"921f7b1683598c928ac486dbdf3741bfa09a28c975aead8fa15375a902699885","bytes":4096,"device":"snoopyp","part":"program"},
{"sha256":"2c1e9bfc8005494fc281c21dd9dbae92d71355fcb802386c79f48bf711232bab","bytes":256,"device":"snoopyp","part":"melody"},
{"sha256":"921f7b1683598c928ac486dbdf3741bfa09a28c975aead8fa15375a902699885","bytes":4096,"device":"snoopyt","part":"program"},
{"sha256":"2c1e9bfc8005494fc281c21dd9dbae92d71355fcb802386c79f48bf711232bab","bytes":256,"device":"snoopyt","part":"melody"},
{"sha256":"09148c55a0dc823556f2c98caea9761b5062a7e5614bae4e96b692d8390f9fad","bytes":4096,"device":"squish","part":"program"},
{"sha256":"d156fde38a4d54e12015aa820cd8363e20455b13f5cc2ab3808c02268107c5a7","bytes":4096,"device":"ssparky","part":"program"},
{"sha256":"f48929ec8c9a9a1e131f4a5d48333fe2dc2b1fbafcdf41815f267b7c73516247","bytes":4096,"device":"stennis","part":"program"},
{"sha256":"af4fed4fe0102e17ab18ea005a74026d5c5545f3193eeb195af7daca8df27ee2","bytes":4096,"device":"tbridge","part":"program"},
{"sha256":"9cb2b6d604d930c94dc8a3d548656b563d487427c957c5c71828b5174385e667","bytes":4096,"device":"tfish","part":"program"},
{"sha256":"9e1237404bcd8edf0b9d415b928d9ef5d5d475e3fbac65d6678a6dcb3eb47c87","bytes":1856,"device":"vermin","part":"program"},
{"sha256":"6a53d017f6b18c52472f7cb40a3fb45a9744c1a3c4bb453a162a168705c0f3c1","bytes":4096,"device":"zelda","part":"program"},
{"sha256":"4dbee2865abcd4767d0c0a1b8a6689efe0c8c49155a9de1ed6ff9abfc43643bc","bytes":256,"device":"zelda","part":"melody"}
];
  var SVG_MANIFEST = [
{"sha256":"db401b6d1774377084bdd12fd7333cb7bcc19854611c7874297aa463b8d4cb30","bytes":72811,"path":"artwork/gnw_ball/gnw_ball.svg"},
{"sha256":"20fa0bb48a7a9cfab813a4c842d1da1e6570dfc47e9041221f379cf23cb0e41d","bytes":589547,"path":"artwork/gnw_bfight/gnw_bfight.svg"},
{"sha256":"c69c97969bafbe2c5b92acda4ba276dc164724a479f130557d495846f9e9128a","bytes":561531,"path":"artwork/gnw_bfightn/gnw_bfightn.svg"},
{"sha256":"027dde7eddb70a6d15c46a762535b7ca5457c67c6fbaf2d93c12bf98086ef170","bytes":114359,"path":"artwork/gnw_bjack/gnw_bjack_bottom.svg"},
{"sha256":"c4c582769bb4b363aee24cd8e884e446d29af45ef5f6fb2ddb6a0268a6242956","bytes":76617,"path":"artwork/gnw_bjack/gnw_bjack_top.svg"},
{"sha256":"1959b5af3a8b37a7f243167edd095b5ec3b7d4f22400d1c8bbe823c6b02531dc","bytes":267045,"path":"artwork/gnw_boxing/gnw_boxing.svg"},
{"sha256":"63c4824cfa5252275cf25f6548637b6cacf215f51b8ade30a897ba3e4c076fe9","bytes":279182,"path":"artwork/gnw_bsweep/gnw_bsweep_bottom.svg"},
{"sha256":"ae12ec5ff7460844b76c49096621c8d79666fc700b43983276c836dfb1ae98ed","bytes":219259,"path":"artwork/gnw_bsweep/gnw_bsweep_top.svg"},
{"sha256":"b117780afee00797cdf42f8dfe125099a699efc059894315d778078e24aaad75","bytes":356585,"path":"artwork/gnw_cgrab/gnw_cgrab.svg"},
{"sha256":"74aa24b59ffd2b59bf81f91a8b94e2f331f99d3cfeebddfece88b17d7b9808a7","bytes":200341,"path":"artwork/gnw_chef/gnw_chef.svg"},
{"sha256":"740452c4b76af3e7430cae7c5ede1b27df0ae53fe3b81f26e2524a2d96d88226","bytes":567878,"path":"artwork/gnw_climber/gnw_climber.svg"},
{"sha256":"389c13b436da2d1b6e9ffc9877decaf76038662e6ffe629f123357709ad7a03f","bytes":545547,"path":"artwork/gnw_climbern/gnw_climbern.svg"},
{"sha256":"0da56c16fe665958c1f1d7cf372050bf3833ecf908a19cf5d757903255888875","bytes":370692,"path":"artwork/gnw_dkcirc/gnw_dkcirc.svg"},
{"sha256":"4f8846901bc76b26ef098f1b9a65a1f9773aa3113ca59a7766bab1f439effe31","bytes":265170,"path":"artwork/gnw_dkhockey/gnw_dkhockey.svg"},
{"sha256":"d1f38e1a77dbacd37dfa5214c1d1e7cff954a6af0adce0e88bc70646904502a9","bytes":282146,"path":"artwork/gnw_dkjr/gnw_dkjr.svg"},
{"sha256":"5ad0b6815a581088d8ebacdc9872017852444c1aeb5435dd84c62398415bd120","bytes":342814,"path":"artwork/gnw_dkjrp/gnw_dkjrp.svg"},
{"sha256":"2fcec16a89557d5ceab65e50ede0b86ec5b1bf0df49b38c4852a93e63a20e42c","bytes":146521,"path":"artwork/gnw_dkong/gnw_dkong_bottom.svg"},
{"sha256":"5f5dbd84a726fb05a1bf46c7c3aa38948cd5e69e7711fe269c4d2aca1539841c","bytes":177776,"path":"artwork/gnw_dkong/gnw_dkong_top.svg"},
{"sha256":"15b40e5486959d1b33952240060bb472afbd53f036df6e8e355760b93584688f","bytes":391531,"path":"artwork/gnw_dkong2/gnw_dkong2_bottom.svg"},
{"sha256":"73734e768c978274c1f70bb440d147d22ff93fc961147444b027b56539835d1e","bytes":268301,"path":"artwork/gnw_dkong2/gnw_dkong2_top.svg"},
{"sha256":"339a166595726460456a0ee1e26e0e49194d9139a4f4679ce94b55fb6f3a8a8c","bytes":294602,"path":"artwork/gnw_dkong3/gnw_dkong3.svg"},
{"sha256":"a6dcd59e0e474b2ea099e42fe4e3ded8c38a333523ef124d1fdc0aefdf3a53c5","bytes":194252,"path":"artwork/gnw_egg/gnw_egg.svg"},
{"sha256":"031e7c5e8e2725f2e16e8ada24fccfbdc49e0ca7926806134f72d9718bc2b6d6","bytes":269534,"path":"artwork/gnw_fireatk/gnw_fireatk.svg"},
{"sha256":"5a351758f7e5015c708a504f531c9540153927df6f0eda4661e8b60dd301c165","bytes":103612,"path":"artwork/gnw_fires/gnw_fires.svg"},
{"sha256":"c48203ca22f8fc8dfbfb7f320700aaa718b295074ad0a0465fb300213bbd06a7","bytes":164998,"path":"artwork/gnw_firews/gnw_fire.svg"},
{"sha256":"a61f10043d00dd8f3a21585793f5a9a2d982aa5e46ce8c3dccb2360948f87e97","bytes":56805,"path":"artwork/gnw_flagman/gnw_flagman.svg"},
{"sha256":"433aba45b2b493c13095d85bff71a0c2cbf27ce03d65d94338f0f8cd4f3bad47","bytes":520873,"path":"artwork/gnw_gcliff/gnw_gcliff_bottom.svg"},
{"sha256":"8ce4562ebdcd5582b8fef692d6a99530509db8ec54528b25ce6ce15432757788","bytes":532129,"path":"artwork/gnw_gcliff/gnw_gcliff_top.svg"},
{"sha256":"e2dcac55bb82463df61fe16b79f77fd4a0f9010f261bcbd6199daf17f55f52f4","bytes":150531,"path":"artwork/gnw_ghouse/gnw_ghouse_bottom.svg"},
{"sha256":"053023ec8dfc4822fcd6d3a0ce79ab324abac04a94fef93ec6ac9e704360416c","bytes":160325,"path":"artwork/gnw_ghouse/gnw_ghouse_top.svg"},
{"sha256":"7fda100a4fa24d2d4c5cdac1a24614ceb3a5f400c8473d9d3a64885e32a3da4e","bytes":110523,"path":"artwork/gnw_helmet/gnw_helmet.svg"},
{"sha256":"4b24fcb7ed2d2dac28d43de40c8c19a59fd302d8b451b85c5c387ba18aad2a1e","bytes":106156,"path":"artwork/gnw_judge/gnw_judge.svg"},
{"sha256":"5917a6516514eb41f4e981d1a6c698f5554e20826428fae7553e23db65eec87e","bytes":157498,"path":"artwork/gnw_lboat/gnw_lboat_left.svg"},
{"sha256":"c46292b8a7ca6b1c494a0ad49872e2068d591d7642026f2bed4e52a6f1377a93","bytes":156142,"path":"artwork/gnw_lboat/gnw_lboat_right.svg"},
{"sha256":"3287f0bf3dac82ce57faba1b53add1b41bdc98bc5cdaeff43779a78774b7f579","bytes":156926,"path":"artwork/gnw_lion/gnw_lion.svg"},
{"sha256":"a58b313a80e816f9c0525fb09d2c109bb5288c761b83039bfd074506cc308da8","bytes":126666,"path":"artwork/gnw_manhole/gnw_manhole.svg"},
{"sha256":"f2f2035d1a60a35d875ee882f2cad9d070ae845fca1d83af7c31a6a49117d201","bytes":225172,"path":"artwork/gnw_manholews/gnw_manholews.svg"},
{"sha256":"2f61efc7797dcd87e43ebc36a2868f76ac109f09b5712e1c1d6f405312158758","bytes":156294,"path":"artwork/gnw_mario/gnw_mario_left.svg"},
{"sha256":"7acdb7e3da77205ff9127925fe3224fdac041b88f9a5d3e249a7b4e645ff774c","bytes":204213,"path":"artwork/gnw_mario/gnw_mario_right.svg"},
{"sha256":"3e0c5dbdc0750c1efcbffa3d1f5b51f2f75a71b267a730cc06c5b1047d8fe6f2","bytes":304752,"path":"artwork/gnw_mariocm/gnw_mariocm.svg"},
{"sha256":"9f7cdafba96d23ca8665cb0416d0978884ac34a09b4c926a0dd990df1cef2247","bytes":295811,"path":"artwork/gnw_mariocmt/gnw_mariocmt.svg"},
{"sha256":"b8858d8a499d42e084164ea78698db5ac96f977845f9255788292af52497e642","bytes":212480,"path":"artwork/gnw_mariotj/gnw_mariotj.svg"},
{"sha256":"5d7e4e226121745c44ba513d95ad813589925737330bf244f26ea57d6a2074dd","bytes":519301,"path":"artwork/gnw_mbaway/gnw_mbaway.svg"},
{"sha256":"46df4f33ed7ed42a48c95f284c94900ef082bda81d80e54ee408dd2e1cafc98e","bytes":123462,"path":"artwork/gnw_mickdon/gnw_mickdon_bottom.svg"},
{"sha256":"2d608b7fa9e689434ee5c4d2c512db07681f86689e7c92dd7004b187d6362d46","bytes":127097,"path":"artwork/gnw_mickdon/gnw_mickdon_top.svg"},
{"sha256":"bb5b2a2bffcd4c60716010951a6569bab20361c33d355ef5a1d5ef83b9ff852e","bytes":182853,"path":"artwork/gnw_mmouse/gnw_mmouse.svg"},
{"sha256":"dd8047bc490098c9f45f881d5396c61875196b100d23274505e4a48ca18da7dc","bytes":278396,"path":"artwork/gnw_mmousep/gnw_mmousep.svg"},
{"sha256":"f4cc48381f04c1d1ae518a3ed048d9e51d71e15d877d709cd34aead414a65bc4","bytes":120914,"path":"artwork/gnw_octopus/gnw_octopus.svg"},
{"sha256":"2a1d45109930b9fa728a944ec107342c56d184e9cc28260c5f0b30194edfe70a","bytes":113943,"path":"artwork/gnw_opanic/gnw_opanic_bottom.svg"},
{"sha256":"e51ca763ed4dcf30034f1f63756e595ce17a10bf0f801cdf929e04fc2e0a294a","bytes":80532,"path":"artwork/gnw_opanic/gnw_opanic_top.svg"},
{"sha256":"17fc8deafbc5206aa524ddbdc19b74dc521ff05fd735a6c854f7a62a85b44820","bytes":170880,"path":"artwork/gnw_pchute/gnw_pchute.svg"},
{"sha256":"43599af8dee6e6ad633b0d4468f8180d453d40995938a8707641d576f78f88f0","bytes":64411,"path":"artwork/gnw_pinball/gnw_pinball_bottom.svg"},
{"sha256":"435558e1dafecd8a335b914e3ab03dd201c9d6441592431004ac34380f55bfb6","bytes":84347,"path":"artwork/gnw_pinball/gnw_pinball_top.svg"},
{"sha256":"360ad99fdcbd6cea85104d2f4f4bc2dcbdaa60d6ce541a7bd504209b37c68f82","bytes":219719,"path":"artwork/gnw_popeye/gnw_popeye.svg"},
{"sha256":"c2d10045b8fdbb1c5d312bf67708b398de7b5d18fd78d974d7d08dc280e8027d","bytes":546685,"path":"artwork/gnw_popeyep/gnw_popeyep.svg"},
{"sha256":"d3264386857e93ce3f9b025e2d87747a703b5eac5faeb336daeccb1965e7294a","bytes":136866,"path":"artwork/gnw_rshower/gnw_rshower_left.svg"},
{"sha256":"e3e1584adbbab4af82ce91ac98ef06fe3e6d84b9b0b92c1263615933a634bc85","bytes":141743,"path":"artwork/gnw_rshower/gnw_rshower_right.svg"},
{"sha256":"9e8c7796433be7051cd3e52f6e2cf72680973bf4b0d402a8078d802a79c4902a","bytes":284193,"path":"artwork/gnw_sbuster/gnw_sbuster_bottom.svg"},
{"sha256":"621be5b7056202a614e215095b34ada3f360f28ad52155b2281f286127e55d9d","bytes":223262,"path":"artwork/gnw_sbuster/gnw_sbuster_top.svg"},
{"sha256":"206326c8a52dddc3f70f9c7c3c85032300036a41621e5a24cbc0722b5966257c","bytes":344665,"path":"artwork/gnw_smb/gnw_smb.svg"},
{"sha256":"7482849ce4280f08b566eb8a4f401336ac7619350d7c8c3e8f1c79d6d012fa16","bytes":651572,"path":"artwork/gnw_smbn/gnw_smbn.svg"},
{"sha256":"2b5eeb4830537fd75615b3ff7dd831228a4d80f19175d68bc249874820cddd4b","bytes":356635,"path":"artwork/gnw_snoopyp/gnw_snoopyp.svg"},
{"sha256":"f1b1078d9efcbdcdccde7e73b3488d0200714c7cd58160dd39bca471cd9c2591","bytes":281182,"path":"artwork/gnw_squish/gnw_squish_bottom.svg"},
{"sha256":"b50d5b118f4342df6fe51889bfcd8fac9d037c87357a778f89c2268b4a6c89df","bytes":73162,"path":"artwork/gnw_squish/gnw_squish_top.svg"},
{"sha256":"803f97224dd9bff1fca47fc6af484a6dac1970abdbc0f9180cdda2471b9ed219","bytes":138996,"path":"artwork/gnw_ssparky/gnw_ssparky.svg"},
{"sha256":"c12a157a26093e69ed323d9490aa4c489eea40e66157156c29191713cf5531ee","bytes":230033,"path":"artwork/gnw_stennis/gnw_stennis.svg"},
{"sha256":"48d387dfb0a2c7720e2ca0408ac79386c8efd9b90a89fbfd61c48a39e7e35865","bytes":244842,"path":"artwork/gnw_tbridge/gnw_tbridge.svg"},
{"sha256":"038da030e3d0874b83d6ee25ef43bdf42ccac4a4b15a6cefa104aa4ecf1b92c5","bytes":259233,"path":"artwork/gnw_tfish/gnw_tfish.svg"},
{"sha256":"32f3f2709b4db5f35c43e549edb60217c322dac795c2aa43fdd05cb9dc046779","bytes":106730,"path":"artwork/gnw_vermin/gnw_vermin.svg"},
{"sha256":"af77426838046e7d94484b6cca75cc456f8e4ae8707dc204c1c1f70716c85131","bytes":426909,"path":"artwork/gnw_zelda/gnw_zelda_bottom.svg"},
{"sha256":"ab346f76a6f706f4bb5a8d95eb5fcd84c4ef9f99dfc3a35a1c1a5e09524cd1c9","bytes":284070,"path":"artwork/gnw_zelda/gnw_zelda_top.svg"}
];
  var TFT = { internal: 131072, mario: 1048576, zelda: 4194304 };

  /* IS THIS ACTUALLY ARM FIRMWARE?
   *
   * The colour units are paired BY SIZE, and 131072 is an ordinary Game Boy
   * cartridge size as well as the internal-flash size. When the first 128 KiB
   * file in a pack was a cartridge, it was handed to the twin as its firmware:
   * the ARM core reset to PC 0, executed cartridge header bytes, and died at
   * the end of the image with PCLOST. On screen that is a black rectangle with
   * no explanation, on the tile AND in the drawer, and nothing anywhere said
   * why -- the failure was indistinguishable from "the emulator is broken".
   *
   * A Cortex-M image begins with its vector table, and the first two words of
   * that table are strongly constrained:
   *   word 0  initial stack pointer  -- word-aligned, non-zero
   *   word 1  reset vector           -- ODD (the Thumb bit is mandatory) and
   *                                     pointing inside the image
   * A Game Boy cartridge fails both, and so does essentially any non-ARM file.
   * The check is four instructions and it converts a silent black screen into
   * a refusal that names the problem. */
  function looksLikeArmFirmware(u8) {
    if (!u8 || u8.length < 8) return false;
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    var sp = dv.getUint32(0, true), rv = dv.getUint32(4, true);
    if (sp === 0 || (sp & 3) !== 0) return false;      // not a usable stack pointer
    if ((rv & 1) === 0) return false;                  // Thumb bit absent
    /* THE RESET VECTOR IS AN ABSOLUTE ADDRESS, NOT AN OFFSET.
     * This first read `rv >= u8.length` and rejected the genuine firmware:
     * its entry point is 0x08017a45, because the image is MAPPED at the part's
     * flash base (0x08000000 here) and the vector table stores the address the
     * core will actually branch to, not a file offset. Comparing it against the
     * file length is comparing an address to a size.
     *   Masking to the low 24 bits gives the offset within its flash region --
     * 0x017a45, or 96,837, which is inside the 128 KiB image and correct. The
     * check still does its job: a Game Boy cartridge has a reset vector of
     * 0x00000000, which fails the Thumb-bit test one line above, and its first
     * word is 0x000150c3, which is not word-aligned and fails the line before
     * that. Both discriminations survive; only the false rejection is gone. */
    if ((rv & 0x00ffffff) >= u8.length) return false;  // entry point outside the image
    return true;
  }

  /* IS THIS AN NES GAME FILE?  MIRRORS the builder's Test-InesHeader / Test-InesComplete
   * / Get-NesMapper, and it has to: a baked nes_games.json and an imported pack are
   * meant to be interchangeable, and they only are if both sides recognise the
   * same files and give them the same keys.
   *
   * 4E 45 53 1A ("NES" + the DOS EOF byte) at offset 0 is the iNES signature, and
   * unlike the Game Boy there is nothing weak about it -- a 32-bit magic number at
   * a fixed offset needs no second opinion, which is why there is no NES
   * equivalent of the logo-plus-header-checksum pair. Sizes, by contrast, say
   * nothing at all: 40,976 (two PRG banks plus one CHR bank plus the header) and
   * 262,160 are ordinary NES lengths and nothing in this file should ever decide
   * an NES game file by length.
   *
   * What the magic cannot say is whether the dump is COMPLETE, so byte 4's PRG
   * bank count is checked against the length. Zero banks is not a game, and a file
   * shorter than its own header's claim is a copy that went wrong; either one
   * would install as a tile that dies on boot. The floor uses the 8-bit byte-4
   * count rather than the NES 2.0 12-bit one deliberately: where NES 2.0 adds high
   * bits the real size is LARGER, so byte 4 alone is always a floor. */
  var NES_MAGIC = [0x4e, 0x45, 0x53, 0x1a];
  function looksLikeInes(u8) {
    if (!u8 || u8.length < 16) return false;
    for (var i = 0; i < 4; i++) if (u8[i] !== NES_MAGIC[i]) return false;
    return true;
  }
  function inesComplete(u8) {
    if (!looksLikeInes(u8)) return false;
    var prg = u8[4];
    if (prg === 0) return false;
    return u8.length >= 16 + 16384 * prg;
  }
  /* The mapper number, all twelve bits. iNES keeps the low nibble in byte 6's high
     nibble and the next nibble in byte 7's high nibble; NES 2.0 -- announced by
     byte 7 bits 2-3 reading 2 -- adds bits 8-11 in byte 8's low nibble. All three
     are implemented, so a NES 2.0 dump of a mapper above 255 is described as
     itself instead of being folded onto some other mapper's number. */
  function nesMapper(u8) {
    if (!u8 || u8.length < 16) return 0;
    var m = ((u8[6] >> 4) & 0x0f) | (((u8[7] >> 4) & 0x0f) << 4);
    if (((u8[7] >> 2) & 0x03) === 2) m |= (u8[8] & 0x0f) << 8;
    return m;
  }

  // Pokemon mini: 10 game files (512 KB each) + one shared 4 KB BIOS ('bios'),
  // matched by whole-file SHA-256 exactly like the classic firmware files.
  var PM_MANIFEST = [
{"sha256":"16b3a68bb9d3e5c577bc6cf6d9d73c39b4c40b76ca3fbf1a0b9288089f97a014","bytes":524288,"device":"pm-pichu-bros-mini"},
{"sha256":"035688227eeb8f381f83e1246a10df8a99b27f63b68e548482de16da42fdb4b2","bytes":524288,"device":"pm-pokemon-breeder-mini"},
{"sha256":"9c6619a683f76dcb63957d02ac4e812f9148b85e05cc6705b24a8a4e6080b221","bytes":524288,"device":"pm-pokemon-party-mini"},
{"sha256":"5ac75fd2b6d5dea85e17e5e6131339e0e19eefe978a6f4b7f8700fb28c89cc23","bytes":524288,"device":"pm-pokemon-pinball-mini"},
{"sha256":"6c473867e9bad1883307d5372dedfa9443a620423d82ae83b6171fcaaffc291e","bytes":524288,"device":"pm-pokemon-puzzle-collection"},
{"sha256":"d75dd948a0bfe92b9f712dbc61cc1fb5ef24c2ddf6a6629f4f00e0fe573f931d","bytes":524288,"device":"pm-pokemon-puzzle-collection-vol-2"},
{"sha256":"bc5d1c0664d0f80900558f1e99dded5fe597535b468aefc13c1dae51c18b4fbb","bytes":524288,"device":"pm-pokemon-race-mini"},
{"sha256":"b54fc57472d363111eb0b229b5e26d3eb653c1b85f211501beab640530d19805","bytes":524288,"device":"pm-pokemon-shock-tetris"},
{"sha256":"dc96d606ed54be035e8c3139a0b20d462b7622b15f617ccc6be411dcbd68c921","bytes":524288,"device":"pm-pokemon-zany-cards"},
{"sha256":"9f34277ae054e8aca6355bc3f73548d860a8ea377103752d403ab150fcc80802","bytes":524288,"device":"pm-togepis-great-adventure"},
{"sha256":"45a1c7f28b9ad585e67f047abe9c1c956724bfcab8c9011002af4274e7c50e8f","bytes":4096,"device":"bios"}
  ];
  var PM_CART = 524288, PM_BIOS = 4096;
  // SINCE 2026-10-12 THIS HOLDS ONLY THE TWO BOOT PROGRAMS. The twelve catalogue
  // cartridge rows (gb-tetris ...) went with the Game Boy showcase entries in
  // index.html (decided: the game server supplies the games), so those dumps are
  // now identified by the Game Boy index like any other cartridge and filed as
  // gb-x<sha12> extras. The history below is kept for its reasons.
  // Game Boy: eight catalogue cartridges + the two shared boot programs — the
  // 256-byte DMG one ('bios') and the 2304-byte CGB one ('biosCgb') — matched by
  // whole-file SHA-256 exactly like the Pokemon mini set.
  //
  // 'biosCgb' WAS MISSING and that was a silent hole, not a design choice: the
  // frontend has read _gbPackContent.biosCgb since the pack path was added
  // (index.html _gbDeviceFor / _gbLoadEmbed) and twin-worker relays
  // __GNW_PACK.gameboy('biosCgb'), but nothing on this side ever WROTE that key,
  // because no manifest row claimed the hash. So a pack containing the CGB boot
  // program imported cleanly and the Color titles still took the DMG path with
  // no message anywhere. Adding the row is the whole fix.
  // `device` IS the catalogue device id; the id minus its `gb-` prefix is also
  // the /carts/ slot name, so there is still no second mapping table anywhere.
  //
  // IDENTITY IS PER-DUMP, NOT PER-TITLE. These are the canonical (No-Intro)
  // dumps of the exact revisions the catalogue documents; a different revision
  // or region of the same game is a different file and will NOT be recognised.
  // That is the site-wide scheme (both manifests above match the same way), not a
  // Game Boy compromise — widening it means adding the other dumps' hashes here.
  var GB_MANIFEST = [
{"sha256":"cf053eccb4ccafff9e67339d4e78e98dce7d1ed59be819d2a1ba2232c6fce1c7","bytes":256,"device":"bios"},
{"sha256":"c56299bedd56debdbf36442238636bf5887a65c5173b33995682052353804da9","bytes":2304,"device":"biosCgb"}
  ];
  // Sizes worth hashing for a Game Boy match. This set OVERLAPS the colour-unit
  // (131072 / 1048576 / 4194304), Pokemon mini (524288) and classic-melody (256)
  // sizes, which is precisely why the Game Boy test has to run FIRST and has to
  // be a hash match: a 128 KiB cartridge would otherwise be swallowed by the
  // colour-unit pairing purely on its length, and a 512 KiB one would be
  // consumed and dropped by the Pokemon mini branch. A non-match falls straight
  // through to the existing paths, so nothing that worked before changes.
  var GB_SIZES = {};
  GB_MANIFEST.forEach(function (g) { GB_SIZES[g.bytes] = 1; });

  /* --- the wider Game Boy index (firmware/site/gb_index.json.gz) -------------------
   *
   * GB_MANIFEST above answers ONE question: "is this file something this site
   * can play?" — the twelve catalogue cartridges and two boot programs.
   *
   * IT WAS EIGHT UNTIL 2026-09-05, AND THE FOUR THAT WERE MISSING WERE EXACTLY
   * THE GAME BOY COLOR ONES. Nobody noticed, because the local /carts/ mount
   * supplied them on the only machine anyone tested on. The moment that mount
   * was retired the four Color titles could not be identified from a pack at
   * all: gbPlayable() went false, and a card that is not playable renders no
   * console art, so they appeared on the page as empty boxes. A source that
   * covers for a gap does not close it -- it hides it. It says nothing about the other few
   * thousand Game Boy dumps a person may have put in the same zip, so those
   * imported in total silence: no tile, no note, no reason.
   *
   * The index answers the OTHER question — "what is this file, and will it
   * run?" — for 4,489 distinct dumps, derived from the 5.2 MB cartridge
   * manifest by tools/build_gb_index.ps1 and reduced to four facts each:
   * canonical name, system, whether it boots, and why not. It is fetched LAZILY
   * (only when a pack is actually being imported, never on page load) and
   * decompressed in the browser, exactly the way gnw.js fetches
   * firmware/output/artwork.json.gz. It carries no game-file bytes — hashes, names and flags
   * only — which is why, unlike anything it describes, it may be committed.
   *
   * THE TWO FLAGS IT CARRIES ARE A PREDICTION ABOUT THIS SITE'S OWN PLAY PAGE.
   * The boot program compares the Nintendo logo at 0x104-0x133 and verifies the
   * header checksum, and halts when either fails. 62 files across the two
   * reference libraries fail one or both. They are not corrupt — most are
   * unlicensed Sachen carts that omit the logo by design and do not boot on real
   * hardware either — so the site warns and declines rather than handing the
   * core something it knows will hang.
   *
   * If the index cannot be fetched, every existing path still works: the pack
   * still identifies and stores the ten things it always could, and the summary
   * says plainly that no verdicts were available. Absence degrades; it does not
   * break.
   * ------------------------------------------------------------------------ */
  /* --- the Pokemon Mini index (firmware/site/pm_index.json.gz) --------------------
   *
   * PM_MANIFEST answers "is this one of the ten titles this site can play?".
   * This answers the other question — "what IS this file?" — for every dump in
   * the No-Intro Pokemon Mini set plus the translated and aftermarket ones,
   * which no DAT can name because a translation is a modified game file.
   *
   * Before it existed, an unmatched 512 KB .min imported in TOTAL SILENCE: the
   * Pokemon Mini branch returned without a word for anything outside the ten,
   * which is precisely the Game Boy problem that gb_index was built to fix. A
   * person dropping their Pokemon Mini collection in was told nothing about any
   * of it.
   *
   * Its shape is deliberately simpler than gb_index's. That one packs 4,489
   * records into newline-delimited fixed-offset strings because the size
   * mattered; this is 47 rows and 1 KB gzipped, so a plain object costs nothing
   * and reads plainly. No boot flags either — the Game Boy index can say a
   * cartridge will hang because the boot firmware checks a logo and a checksum, and
   * the Pokemon Mini has no equivalent check to predict. Claiming one would be
   * inventing a verdict.
   *
   * No game-file bytes: names, sizes and hashes only.
   * -------------------------------------------------------------------- */
  var PM_INDEX = null, PM_INDEX_PREFIX = 12, _pmIndexReady = null;
  var PM_EXT = /\.min$/i;
  var PM_INDEX_URL = (function () {
    try {
      var sc = document.currentScript && document.currentScript.src;
      if (sc) return sc.replace(/[^/]*$/, '') + 'pm_index.json.gz';
    } catch (e) {}
    return 'firmware/site/pm_index.json.gz';
  })();

  function loadPmIndex() {
    if (_pmIndexReady) return _pmIndexReady;
    _pmIndexReady = fetch(PM_INDEX_URL)
      .then(function (r) { if (!r.ok) throw new Error('pm_index.json.gz HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) {
        var u = new Uint8Array(ab);
        // Same gzip sniff as the Game Boy index, for the same reason: a host
        // that serves .gz with Content-Encoding: gzip has already decompressed
        // it by the time fetch() hands the bytes over.
        if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
          var ds = new DecompressionStream('gzip');
          var w = ds.writable.getWriter(); w.write(u); w.close();
          return new Response(ds.readable).json();
        }
        return JSON.parse(utf8(u));
      })
      .then(function (j) {
        PM_INDEX_PREFIX = j.prefix || 12;
        PM_INDEX = j.rows || null;
        return PM_INDEX;
      })
      .catch(function (err) {
        console.warn('[pack] Pokemon Mini index unavailable (' + PM_INDEX_URL + '):', err && err.message || err);
        PM_INDEX = null;
        return null;                                 // never rejects — a missing index is not an import failure
      });
    return _pmIndexReady;
  }

  var GB_EXT = /\.(gb|gbc|sgb)$/i;
  var GB_REPORT_CAP = 300;     // rows kept for the Settings summary; counts are exact regardless

  /* --- what the pack KEEPS, beyond the catalogue's own eight -----------------
   *
   * Until now a pack stored bytes for ten things and nothing else: a person
   * could drop in a library, watch Settings name three thousand cartridges as
   * recognised, and find not one of them on the Game Boy page. Recognising a
   * file and being able to play it were two different questions, and only the
   * first was ever answered.
   *
   * Now anything the index says BOOTS is kept, with its canonical name and its
   * system, and the Game Boy page builds a tile from it. Which makes the budget
   * below load-bearing rather than decorative: the whole pack is a SINGLE
   * IndexedDB record, so "keep everything" would mean assembling a multi-
   * gigabyte value in memory and writing it in one transaction, on a page whose
   * other three catalogues are waiting on the same promise.
   *
   * The two caps are deliberately different kinds. The file count is what keeps
   * the Game Boy page a page rather than a directory listing; the byte cap is
   * what keeps the write survivable. Whichever binds first, binds -- and what
   * does not fit is COUNTED and reported (`gb.overflow`), never dropped in
   * silence. A person who drops 4,600 cartridges in should be told that 64 of
   * them are playable and the rest are not, which is a fact about this site and
   * not about their files. */
  var GB_EXTRA_MAX_FILES = 64;
  var GB_EXTRA_MAX_BYTES = 32 * 1024 * 1024;

  /* --- what the pack KEEPS for the NES ---------------------------------------
   *
   * The same three caps as the Game Boy's extra titles, and the same numbers as
   * build_nintendo.ps1's $NesMaxFiles / $NesMaxBytes / $NesCartMaxBytes, because
   * a pack and a baked build that disagree about the budget disagree about which
   * titles exist.
   *
   * There is no NES catalogue and there is not meant to be one: the NES titles
   * that count are the ones loaded through this button or staged in the firmware
   * folder. So every NES game file here is a kept file rather than a recognised one,
   * which makes the count cap the thing that keeps the NES shelf a shelf and the
   * byte cap the thing that keeps the single IndexedDB write survivable. Whichever
   * binds first binds, and what does not fit is COUNTED (`nes.report.overflow`),
   * never dropped in silence.
   *
   * The per-file ceiling is the one every system shares with the game server
   * and the "Play a file" button (29 Oct 2026): 64 MB, plus the 16-byte header
   * and 512-byte trainer. NES 2.0 headers describe more than the old iNES
   * 4 MiB + 2 MiB, and the large multicarts use it. The 48 MB byte cap still
   * binds first for a 64 MB multicart, which is counted as overflow. */
  var NES_MAX_FILES = 64;
  var NES_MAX_BYTES = 48 * 1024 * 1024;
  var NES_CART_MAX_BYTES = 64 * 1024 * 1024 + 16 + 512;
  /* How many hex digits of the sha256 an 'nes-x…' key carries. Its own constant
     rather than GB_INDEX_PREFIX, which looks like the same 12 and is not: that one
     is whatever the fetched Game Boy index declares (`j.prefix || 12`), so keying
     NES titles off it would make a title's id depend on a file the NES has nothing
     to do with, and a pack imported with one index would stop matching a build made
     with another. The builder hard-codes 12; so does this. */
  var NES_KEY_PREFIX = 12;

  /* --- THE FAMICOM DISK SYSTEM (2026-10-03) -----------------------------------
   * A disk is kept in the SAME `nes` map as a cartridge, keyed 'nes-x' + 12 hex
   * of its sha256 exactly like one, and marked c:'fds'. One emulator plays both,
   * and the play page tells them apart by content (play/nes/app.js), so a disk
   * needs no second id scheme, relay or store. The NES caps apply to both.
   *   Recognised by content: an fwNES container ("FDS" 1A, 16-byte header, then
   * whole 65,500-byte sides) or a raw image of whole sides whose first block is
   * "\x01*NINTENDO-HVC*". A .qd file (65,536-byte sides with CRCs) is a disk
   * too, but not one the core can mount, so it is not kept.
   *
   * THE DRIVE'S BOOT FIRMWARE is held apart from the titles, the way the Atari
   * BIOS is: 8 KB, matched by sha256 against the three known images. Never a
   * title; reached through __GNW_PACK.fdsBios(). */
  var FDS_SIDE_BYTES = 65500;
  var FDS_BIOS = {
    'fdc1a76e654feea993fcb38366e05ee5f4eb641f86fe6bebaeefd412e112dd72': 'Family Computer Disk System boot firmware',
    '99c18490ed9002d9c6d999b9d8d15be5c051bdfa7cc7e73318053c9a994b0178': 'Family Computer Disk System boot firmware (Rev 1)',
    'a0a9d57cbace21bf9c85c2b85e86656317f0768d7772acc90c7411ab1dbff2bf': 'Sharp Twin Famicom boot firmware'
  };
  function looksLikeFdsDisk(u8) {
    var n = u8.length;
    if (n >= 16 + FDS_SIDE_BYTES && u8[0] === 0x46 && u8[1] === 0x44 && u8[2] === 0x53 && u8[3] === 0x1a)
      return (n - 16) % FDS_SIDE_BYTES === 0;
    if (n < FDS_SIDE_BYTES || n % FDS_SIDE_BYTES !== 0 || u8[0] !== 0x01) return false;
    var sig = '*NINTENDO-HVC*';
    for (var i = 0; i < sig.length; i++) if (u8[1 + i] !== sig.charCodeAt(i)) return false;
    return true;
  }
  /* Which of the three consoles a cartridge is shown on (/nes-console.js). Read
     from the file while its bytes are in hand -- an NES 2.0 header can decide
     what a name cannot -- and stored as `c`. Absent when nes-console.js is not
     loaded; the catalogue then decides from the name alone, which measured the
     same over a whole local library. */
  function nesConsoleOf(name, u8) {
    try { return (typeof NesConsole !== 'undefined') ? NesConsole.classify({ name: name, bytes: u8 }).console : undefined; }
    catch (e) { return undefined; }
  }

  /* ===========================================================================
   * ATARI -- the four machines, mirroring firmware/scripts/lib/build_atari.ps1
   *
   * Two routes for a person's own cartridges were asked for: "allow me to add games to
   * the firmware folder or the content page in settings." The firmware folder is
   * build_atari.ps1; this is the other one, and the two have to agree about
   * every id or a title imported here would not be the title the builder baked.
   * So the key shape, the hash length, the per-system size bounds and the
   * classification order below are all that script's, copied deliberately.
   *
   * THE SIZE BOUNDS ARE ITS $SYS TABLE. min is what the machine's smallest real
   * cartridge is; max is the ceiling that distinguishes a cartridge from
   * somebody's disk image.
   *
   * THE CAPS ARE NOT ITS, AND THAT IS THE ONE PLACE THIS DIVERGES ON PURPOSE.
   * The builder writes files and has no reason to stop; this writes ONE
   * IndexedDB record and does. The NES sink's reasoning applies unchanged --
   * whichever cap binds first binds, and what does not fit is COUNTED, never
   * dropped in silence -- but the numbers are different because the shelves are:
   * an Atari 2600 cartridge is 2-32 KB where an NES one is 40 KB to 1 MB, so the
   * 2600 library measured here is 2,091 files in about 12 MB. A file cap of 64
   * would refuse 97% of it. The BYTE cap is therefore the one expected to bind,
   * and the file cap is set where it stops being a shelf rather than where the
   * bytes stop fitting.
   * ======================================================================== */
  var ATARI_MAX_FILES = 4096;
  var ATARI_MAX_BYTES = 48 * 1024 * 1024;
  var ATARI_KEY_PREFIX = 12;     // the builder hard-codes 12; so does this
  /* prefix, min, max -- build_atari.ps1's $SYS verbatim. The prefix is also
     the id's, so there is no second spelling of it anywhere. */
  var ATARI_SYS = {
    a2600: { min: 64,   max: 512 * 1024 },
    a5200: { min: 2048, max: 512 * 1024 },
    a7800: { min: 256,  max: 1024 * 1024 + 128 },      // + the .a78 header
    alynx: { min: 64,   max: 2 * 1024 * 1024 + 64 }    // + the .lnx header
  };
  /* Console firmware BY CONTENT HASH -- build_atari.ps1's $BIOS table. These
     are routed to the pack's `bios` section and never offered as titles, because
     a BIOS is a required part of a machine and not a game. Two names for the
     5200's one image ('5200.rom' and '[BIOS] Atari 5200 (USA).a52') hash to the
     same 06b250f1..., which is how that question was settled there and is why it
     is settled by hash here. */
  var ATARI_BIOS = {
    '06b250f18983d058c0f156ce7ee88ae48b6eaf11e6f10f21dccf6ac7ffb6a6af': { s: 'a5200', what: 'Atari 5200 BIOS' },
    '7d94551defcd8e7b045a34255654d6d169a683f63062d51dee3eedabf2042db0': { s: 'a7800', what: 'Atari 7800 BIOS (NTSC)' },
    '69b8417ba85a0a4af8325b94996bf76ec2a2535814f5f39c3121775e681968f7': { s: 'a7800', what: 'Atari 7800 BIOS (NTSC, alt dump)' },
    '63e1884e27c89d47e968e2c31dd268e17b415be590865739d5b366c76c123c48': { s: 'a7800', what: 'Atari 7800 BIOS (PAL)' },
    '368a5b43b9ab18c7108341e7da5cb3c65dbe5ca1d8334eb8654bf3d73b6f6308': { s: 'a7800', what: 'Atari 7800 High Score Cartridge BIOS' },
    /* The Lynx's two, which this table lacked until 2026-10-02 although the
       builder's has always had them -- so a Lynx boot firmware file in a pack was offered
       as a cartridge here while the baked build filed it as firmware. */
    '2e3aaf5ab638ad7d735232736bad78c90c4fce98f7a7974fd1d734f0c2e57d60': { s: 'alynx', what: 'Atari Lynx boot firmware' },
    'c26a36c1990bcf841155e5a6fea4d2ee1a4d53b3cc772e70f257a962ad43b383': { s: 'alynx', what: 'Atari Lynx boot firmware (common dump)' }
  };
  /* The lengths of every image in ATARI_BIOS, so only those are hashed by the
     firmware pass in identify(). Derived from nothing else: a new entry above
     with a new length must add it here. */
  var ATARI_BIOS_SIZES = { 512: 1, 2048: 1, 4096: 1, 16384: 1 };
  /* Atari-SPECIFIC extensions only. The builder also takes '.bin' and '.rom' as
     2600 images and says in its own header why that is the ambiguity it cannot
     resolve: these files have no header and no magic number, so nothing in the
     bytes separates a 2600 cartridge from a 5200 one -- it measured the obvious
     test and found it does not separate them (the 6502 reset vector lands in
     $Fxxx for 84% of 2600 images and about half of 5200 ones).
       THIS SINK DECLINES '.bin' AND '.rom', AND THAT IS A DELIBERATE DIVERGENCE
     rather than an oversight. The builder is pointed by its user at a folder they
     know holds Atari dumps, so there "extension decides" is a guess between
     four Atari machines. This is handed an arbitrary zip, where a '.bin' is as
     likely to be a BIOS, a disk image, a firmware blob or a save as it is to be
     a cartridge -- so the same guess would be across different consoles, and a
     wrong one puts a non-cartridge in the catalogue with a Play badge on it.
     Declined files are COUNTED and named (`atariReport.ambiguous`), never
     dropped in silence, so a visitor whose dumps are all '.bin' is told why they
     did not arrive rather than left to wonder. */
  var ATARI_EXT = { '.a26': 'a2600', '.a52': 'a5200', '.a78': 'a7800', '.lnx': 'alynx', '.o': 'alynx', '.lyx': 'alynx' };
  var ATARI_AMBIGUOUS_EXT = /\.(bin|rom)$/i;

  function atariExtOf(name) {
    var m = /(\.[^.\/]+)$/.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }
  /* CONTENT SIGNATURES FOR HEADERLESS IMAGES -- build_atari.ps1's
     Get-AtariKind step 4, and its header has the measurements. Both are the
     consoles' own tests, so they are decisive rather than a guess, and that is
     why a `.bin` passing one IS claimed here even though this sink declines
     `.bin` on extension: the decline is about extensions, and these are not.
       Lynx: the boot loader frame -- byte 0 is 256-n (n 1..5), and the first
     51-byte block, LSB first, is below the public modulus and decrypts
     (c^3 mod N) to a block whose skipped top byte is 0x15. 1,197 of 1,197 Lynx
     loaders in a local library; 0 of 5,212 2600 images.
       7800: the BIOS's cartridge test on FFF8-FFFF in the three layouts the
     core tries, and not a 2600 image (vectors repeating every 8 KB). 45 of 45
     headerless 7800 .bin games; 0 of 5,212 2600 and 0 of 409 5200 images. */
  var LYNX_N = (function () {
    var hex = '35b5a3942806d8a22695d771b23cfd561c4a19b6a3b02600365a306e3c4d63381bd41c136489364cf2ba2a58f4fee1fdac7e79';
    try { return BigInt('0x' + hex); } catch (e) { return null; }
  })();
  function atariLynxLoader(u8) {
    if (!LYNX_N || u8.length < 52 || u8[0] < 0xFB) return false;
    var c = BigInt(0);
    for (var i = 51; i >= 1; i--) c = (c << BigInt(8)) | BigInt(u8[i]);   // LSB first
    if (c >= LYNX_N) return false;
    var m = (((c * c) % LYNX_N) * c) % LYNX_N;
    return Number((m >> BigInt(400)) & BigInt(0xFF)) === 0x15;           // byte 50
  }
  function atari7800Tail(u8, end) {
    var o = end - 8;
    if (o < 0) return false;
    var rv = u8[o + 4] | (u8[o + 5] << 8);
    if (rv === 0 || rv === 0xFFFF) return false;
    if ((u8[o] & 0xF1) !== 0xF1) return false;
    if ((u8[o + 1] & 0x0B) !== 0x03) return false;
    var page = u8[o + 1] >> 4;
    if (page < 4) return false;
    return (rv >> 8) >= (page << 4);
  }
  function atari2600Mirror(u8) {
    var L = u8.length, a = [0xDFFA, 0xBFFA, 0x9FFA, 0x7FFA, 0x5FFA];
    for (var k = 0; k < a.length; k++) {
      var off = L - (0x10000 - a[k]);
      if (off < 0) return false;
      for (var i = 0; i < 6; i++) if (u8[off + i] !== u8[L - 6 + i]) return false;
    }
    return true;
  }
  function atari7800Image(u8) {
    var L = u8.length;
    if (L < 4096) return false;
    if (atari7800Tail(u8, L)) return !atari2600Mirror(u8);
    if (L === 131072 && atari7800Tail(u8, 15 * 8192)) return true;   // Activision
    return atari7800Tail(u8, L >> 1);                                // bankset
  }
  /* Classification, in build_atari.ps1's Get-AtariKind order: magic first
     because it is decisive, then the content signatures, then the extension.
     The BIOS-by-hash and BIOS-by-size steps need the hash, so they happen in the
     caller where the hash already exists -- and a BIOS passes neither content
     signature (measured: all seven fail both), so splitting them out does not
     change any answer. Returns {s, how} or null. */
  function atariKindSync(u8, name) {
    if (!u8 || u8.length < 64) return null;
    if (u8.length >= 4 && u8[0] === 0x4C && u8[1] === 0x59 && u8[2] === 0x4E && u8[3] === 0x58) {
      return { s: 'alynx', how: 'magic' };          // "LYNX"
    }
    if (u8.length >= 10) {
      var tag = '';
      for (var i = 1; i < 10; i++) tag += String.fromCharCode(u8[i]);
      if (tag === 'ATARI7800') return { s: 'a7800', how: 'magic' };
    }
    if (atariLynxLoader(u8)) return { s: 'alynx', how: 'content' };
    if (atari7800Image(u8)) return { s: 'a7800', how: 'content' };
    var ext = atariExtOf(name);
    if (ATARI_EXT[ext]) return { s: ATARI_EXT[ext], how: 'extension' };
    return null;
  }
  var GB_INDEX_URL = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;   // .../firmware/site/content_pack.js?v=…
      if (s) return s.replace(/[^/]*$/, '') + 'gb_index.json.gz?v=2.1.0';   // cache tag: bump when the index is rebuilt (17 Oct: Sachen MMC2 boards are Color; 23 Oct: Binary Monsters II on the Game Boy shelf)
    } catch (e) {}
    return 'firmware/site/gb_index.json.gz?v=2.1.0';
  })();
  var GB_INDEX = null;         // { <sha256 prefix>: { s, b, n, name } } once loaded
  var GB_INDEX_PREFIX = 12;
  var GB_INDEX_META = null;
  var _gbIndexReady = null;
  function loadGbIndex() {
    if (_gbIndexReady) return _gbIndexReady;
    _gbIndexReady = fetch(GB_INDEX_URL)
      .then(function (r) { if (!r.ok) throw new Error('gb_index.json.gz HTTP ' + r.status); return r.arrayBuffer(); })
      .then(function (ab) {
        var u = new Uint8Array(ab);
        // SNIFF THE GZIP MAGIC rather than assuming it. A static host that
        // serves a .gz with Content-Encoding: gzip has already decompressed it
        // by the time fetch() hands the bytes over, and piping that through
        // DecompressionStream would throw on a file that is perfectly fine. One
        // artefact, both hosts.
        if (u.length > 2 && u[0] === 0x1f && u[1] === 0x8b) {
          var ds = new DecompressionStream('gzip');
          var w = ds.writable.getWriter(); w.write(u); w.close();
          return new Response(ds.readable).json();
        }
        return JSON.parse(utf8(u));
      })
      .then(function (j) {
        GB_INDEX_PREFIX = j.prefix || 12;
        var map = {}, rows = String(j.rows || '').split('\n'), i, r;
        for (i = 0; i < rows.length; i++) {
          r = rows[i];
          if (r.length < GB_INDEX_PREFIX + 3) continue;
          map[r.slice(0, GB_INDEX_PREFIX)] = {
            s: +r.charAt(GB_INDEX_PREFIX),          // 0 dmg / 1 cgb-enhanced / 2 cgb-only
            b: +r.charAt(GB_INDEX_PREFIX + 1),      // 0 boots / 1 logo / 2 header cksum / 3 both
            n: +r.charAt(GB_INDEX_PREFIX + 2),      // 1 = the name is the No-Intro name
            name: r.slice(GB_INDEX_PREFIX + 3)
          };
        }
        GB_INDEX = map;
        GB_INDEX_META = { records: j.records, unique: j.unique, wontboot: j.wontboot, source: j.source };
        return map;
      })
      .catch(function (err) {
        console.warn('[pack] Game Boy index unavailable (' + GB_INDEX_URL + '):', err && err.message || err);
        GB_INDEX = null; GB_INDEX_META = null;
        return null;                                 // never rejects — a missing index is not an import failure
      });
    return _gbIndexReady;
  }
  // Friendly names for the two things the index deliberately does not describe.
  // A boot program is not a cartridge: it has no header, so the cartridge boot
  // flags cannot speak about it, and the manifest rejects it for exactly that
  // reason. GB_MANIFEST identifies these, and it is the only thing that should.
  var GB_PART_NAME = { bios: 'Game Boy boot program', biosCgb: 'Game Boy Color boot program' };

  var MAX_PROGRAM = 262144;      // Firmware candidates: this size or smaller (matches builder)
  var MAX_SVG = 2097152;     // SVG candidates: this size or smaller

  var _dec = new TextDecoder();
  function utf8(u8) { return _dec.decode(u8); }

  // --- SHA-256 → lowercase hex ------------------------------------------------
  // cwsDigest (firmware/site/sha.js) falls back to pure JS where crypto.subtle is
  // missing -- plain http at the LAN address, which is how the TV loads us.
  function sha256hex(u8) {
    return (window.cwsDigest ? cwsDigest('SHA-256', u8) : crypto.subtle.digest('SHA-256', u8)).then(function (buf) {
      var a = new Uint8Array(buf), s = '';
      for (var i = 0; i < a.length; i++) s += (a[i] >>> 4).toString(16) + (a[i] & 15).toString(16);
      return s;
    });
  }

  // --- Uint8Array → base64 (chunked, matches the builder's b64 output) --------
  function b64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }

  // --- raw DEFLATE inflate via the browser's own DecompressionStream ----------
  function inflateRaw(u8) {
    var ds = new DecompressionStream('deflate-raw');
    var w = ds.writable.getWriter();
    w.write(u8); w.close();
    return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }

  /* --- NESTED-ARCHIVE GUARDS -------------------------------------------------
     Mirrors firmware/scripts/lib/build_nintendo.ps1 ($MaxArchiveDepth / $MaxArchiveBytes and
     its Test-ArchiveBudget). The two implementations must not drift, so the
     semantics are copied exactly rather than reinvented:

       * DEPTH. A top-level archive is depth 1, so 8 means "a zip in a zip in a
         zip ... eight deep". A child is tested at parent+1 and refused when that
         exceeds the limit. Real dump sets are 1-2 deep.
       * BYTES. Only NESTED archives are charged. The top-level archive the user
         picked is deliberately not counted -- it is a file they already have,
         and an honest 20 GB library must not trip a cap that exists for a 40 KB
         bomb. A bomb multiplies by ~16 a level, so 8 GB stops one within a few
         levels while a real pack never inflates more than a few MB.
       * ANNOUNCED. Both refusals are recorded, because a scan that quietly
         stopped looking would report "missing firmware" and be believed. The script
         prints a red INCOMPLETE: line beside its counts; the browser equivalent
         is _scan, carried out through identify() into the pack and shown in the
         import UI (see summarize() and fmt() in index.html). Console alone would
         not do: nobody opening a content pack has the console open.

     The budget is charged from the central directory's DECLARED uncompressed
     size, before anything is inflated. That is what the script charges too
     ($e.Length is the entry's uncompressed length), and it is the whole point:
     charging after inflation would mean the tab had already allocated the bomb.
     When a zip declares nothing useful (0, e.g. a streamed entry with a data
     descriptor) the post-inflation length is charged instead, so the guard
     degrades to the old behaviour rather than to no guard at all. */
  var MAX_ARCHIVE_DEPTH = 8;
  var MAX_ARCHIVE_BYTES = 8 * 1024 * 1024 * 1024;   // 8 GB of NESTED inflation
  var _scan = null;

  function resetScan() {
    _scan = { bytes: 0, depthCapHits: 0, byteCapHit: false,
              depthLimit: MAX_ARCHIVE_DEPTH, byteLimit: MAX_ARCHIVE_BYTES };
  }
  resetScan();

  // TRUE = there is room to open this one. Both refusals are announced.
  function archiveBudgetOk(what, size, depth) {
    if (depth > MAX_ARCHIVE_DEPTH) {
      _scan.depthCapHits++;
      console.warn('[pack] nested deeper than ' + MAX_ARCHIVE_DEPTH + ' archives — NOT opening ' + what);
      return false;
    }
    if (_scan.bytes + size > MAX_ARCHIVE_BYTES) {
      if (!_scan.byteCapHit) {
        _scan.byteCapHit = true;
        console.warn('[pack] archive expansion cap reached (' + MAX_ARCHIVE_BYTES +
                     ' bytes) — no further archives will be opened, starting with ' + what);
      }
      return false;
    }
    _scan.bytes += size;
    return true;
  }

  // --- minimal .zip reader: central directory + stored/deflate entries --------
  // Recurses into nested .zip entries, namespacing inner names under the outer
  // archive's name so per-unit TFT files never collide (…/HXA-001.zip/… etc).
  // .7z/.rar can't be read in-browser (no library) — those are simply skipped.
  // Unchanged: that skip is deliberate and stays. The builder follows .7z/.rar
  // when 7-Zip is present, as a superset; the browser has no reader for either
  // and must go on ignoring them harmlessly rather than failing the import.
  //
  // The public entry point. It resets the scan budget, so one import is one
  // budget -- exactly as one run of the build script is one budget.
  function readZip(buf) {
    resetScan();
    return readZipAt(buf, 1, '');
  }

  // depth: 1 for the archive the user picked. label: for the warnings only --
  // entry NAMES are built exactly as before (e.name + '/' + inner name), so
  // container/pairing keys and therefore identification are untouched.
  function readZipAt(buf, depth, label) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), n = buf.byteLength;
    if (n < 22) return Promise.reject(new Error('File too small to be a .zip.'));
    var eocd = -1, min = Math.max(0, n - 22 - 65535);
    for (var i = n - 22; i >= min; i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) return Promise.reject(new Error('Not a valid .zip (no end-of-central-directory record).'));
    var count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var meta = [], p = cdOff;
    for (var k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var comp = dv.getUint32(p + 20, true);
      // The DECLARED uncompressed size. Read only so a nested archive can be
      // charged to the byte budget BEFORE it is inflated; nothing else uses it,
      // and it is never trusted as a fact about the bytes.
      var usize = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commLen = dv.getUint16(p + 32, true);
      var lho = dv.getUint32(p + 42, true);
      var name = utf8(u8.subarray(p + 46, p + 46 + nameLen));
      meta.push({ name: name, method: method, comp: comp, usize: usize, lho: lho });
      p += 46 + nameLen + extraLen + commLen;
    }
    var out = [], chain = Promise.resolve();
    meta.forEach(function (e) {
      if (!e.name || e.name.charAt(e.name.length - 1) === '/') return;   // directory entry
      chain = chain.then(function () {
        var lp = e.lho;
        if (dv.getUint32(lp, true) !== 0x04034b50) return;               // bad/again-central; skip
        var lNameLen = dv.getUint16(lp + 26, true), lExtraLen = dv.getUint16(lp + 28, true);
        var start = lp + 30 + lNameLen + lExtraLen;
        var body = u8.subarray(start, start + e.comp);
        var isZipName = /\.zip$/i.test(e.name);
        var childLabel = (label ? label + '/' : '') + e.name;
        // Charged and refused BEFORE a byte is inflated, where the size is
        // declared. A refused archive is skipped entirely -- like the script, an
        // archive entry is its contents, never also a file of its own.
        var charged = isZipName && e.usize > 22;
        if (charged && !archiveBudgetOk(childLabel, e.usize, depth + 1)) return;
        var data = (e.method === 0) ? Promise.resolve(body.slice())
                 : (e.method === 8) ? inflateRaw(body)
                 : null;
        if (!data) return;                                               // unsupported compression
        return data.then(function (bytes) {
          if (isZipName && bytes.byteLength > 22) {                      // nested archive
            // Only reachable uncharged when the entry declared no useful size;
            // charge what it actually turned out to be, so the guard still holds.
            if (!charged && !archiveBudgetOk(childLabel, bytes.byteLength, depth + 1)) return;
            var ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            return readZipAt(ab, depth + 1, childLabel).then(function (inner) {
              inner.forEach(function (x) { out.push({ name: e.name + '/' + x.name, bytes: x.bytes }); });
            }).catch(function () { /* skip an unreadable nested zip */ });
          }
          out.push({ name: e.name, bytes: bytes });
        });
      });
    });
    return chain.then(function () { return out; });
  }

  // --- identify entries → { programs, art, tft } (mirrors the builder's Consider) -
  function identify(entries) {
    var programByHash = {}, svgByHash = {}, pmByHash = {}, gbByHash = {};
    GNW_MANIFEST.forEach(function (r) { (programByHash[r.sha256] = programByHash[r.sha256] || []).push(r); });
    SVG_MANIFEST.forEach(function (s) { svgByHash[s.sha256] = s.path; });
    PM_MANIFEST.forEach(function (p) { pmByHash[p.sha256] = p.device; });
    GB_MANIFEST.forEach(function (g) { gbByHash[g.sha256] = g.device; });
    var knownLens = GNW_MANIFEST.map(function (r) { return r.bytes; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; })
      .sort(function (a, b) { return b - a; });

    var fw = {}, art = {}, groups = {}, pmini = {}, gboy = {};   // groups[dir] = { internal, mario, zelda }
    // Cartridges beyond the catalogue's eight, keyed by the SAME 'gb-<slot>'
    // shape the eight use, so one accessor answers for both and the play page
    // needs no second code path. Slot is 'x' + the index hash prefix, which is
    // stable across imports and cannot collide with a catalogue slot name.
    var gboyExtra = {}, gbxCount = 0, gbxBytes = 0;
    // NES, keyed 'nes-x' + the same 12-hex hash prefix the builder uses. Records
    // are {n, z, m, b} -- name, length, mapper, bytes -- and the manifest the
    // builder writes is this map with `b` removed, so a baked build and this are
    // one thing seen from two sides.
    var nes = {}, nesCount = 0, nesBytes = 0;
    // The NES verdict sheet. Three counts and no per-file rows: with no catalogue
    // and no index there is no name to report beyond the filename, which the kept
    // record already carries. `truncated` is dumps refused as incomplete, which is
    // the one NES failure worth a number of its own -- it is the difference between
    // "your pack has no NES games" and "your NES dumps are half-copied".
    var nesRep = { checked: 0, kept: 0, overflow: 0, truncated: 0 };
    /* ATARI, keyed '<prefix>-x' + the same 12-hex hash prefix the builder uses.
       Records are {s, n, z, b} -- machine, name, length, bytes -- and the
       manifest the builder writes is this map with `b` removed and `s` kept,
       which is why `s` is stored rather than derived from the key: the manifest
       is the authority on which machine a file is, and the catalogue reads it
       from there. One map for four machines, as the catalogue has one array. */
    var atari = {}, atariCount = 0, atariBytes = 0;
    /* Firmware found, by content hash, held apart from the titles exactly as the
       builder holds it apart -- a BIOS is a required part of a machine, not a
       game, and offering it as a title would put an unplayable tile in the
       catalogue. Records are {s, n, z, what}: no bytes, for now, because nothing
       on this site can yet use them (see the report in atariReport). */
    var atariBiosFound = {};
    /* The Disk System's boot firmware, {sha256: {n, z, what, b}} -- FDS_BIOS. */
    var fdsBiosFound = {};
    /* ONE PLACE A FIRMWARE IMAGE IS RECORDED, WITH ITS BYTES. Until 2026-10-02
       the record was {s, n, z, what} and nothing else -- the builder's same
       omission -- so a user's 5200 BIOS, classified correctly, reached no
       core. `b` is the base64, exactly as a title carries it. It goes in
       `atariBios`, never in `atari`: firmware is not a title. NONE OF THE CORES
       NEEDS IT (each has firmware of its own); this is what lets a user's own be
       offered to the core as an option. */
    function recordAtariBios(h, bios, e, len) {
      if (atariBiosFound[h]) return;
      atariBiosFound[h] = { s: bios.s, n: String(e.name).replace(/^.*\//, ''), z: len, what: bios.what, b: b64(e.bytes) };
      atariRep.bios++;
    }
    /* The Atari verdict sheet. `ambiguous` is the count of .bin/.rom files
       declined for the reason ATARI_EXT's comment gives, and `ambiguousNames`
       the first few of them, because "your pack has no Atari games" and "your
       Atari dumps are all named .bin" are different answers and only one of them
       tells the visitor what to do. `biosOnly` counts console firmware found,
       which is the 5200's whole story: its shelf can be full and still not
       boot. */
    var atariRep = { checked: 0, kept: 0, overflow: 0, outOfRange: 0,
                     ambiguous: 0, ambiguousNames: [], bios: 0, byMagic: 0, byExtension: 0 };
    // The Game Boy verdict sheet: what was looked at and what each file turned
    // out to be. Counts are exact; `files` is capped (GB_REPORT_CAP) because a
    // person may drop a whole library in and IndexedDB should not hold a row per
    // cartridge to render a status line.
    var gbRep = { checked: 0, good: 0, wontboot: 0, unknown: 0, indexed: !!GB_INDEX, files: [], truncated: 0,
                  kept: 0, overflow: 0 };
    // The Pokemon Mini equivalent. No `wontboot`: see the index's own note.
    var pmRep = { checked: 0, known: 0, unknown: 0, indexed: !!PM_INDEX, files: [], truncated: 0 };

    /* ONE FILE'S VERDICT, Pokemon Mini. Two outcomes, not three:
     *   'g'  known — the index names it. If it is also one of the ten this site
     *        plays it has already been stored; if not, it is recognised and
     *        named, which is what the site can honestly offer.
     *   'u'  unknown — no hash match. Not a judgement: the reference set is
     *        No-Intro plus what we could hash, and homebrew is simply not in it.
     * There is no "will not boot" outcome because there is nothing to predict
     * it from -- the Pokemon Mini has no logo or header-checksum gate. */
    function pmClassify(entry, hash, device, rep) {
      var row = PM_INDEX ? PM_INDEX[hash.slice(0, PM_INDEX_PREFIX)] : null;
      if (!device && !row && !PM_EXT.test(entry.name)) return false;
      rep.checked++;
      var leaf = String(entry.name).replace(/^.*\//, '');
      var outcome = (device || row) ? 'g' : 'u';
      if (outcome === 'g') rep.known++; else rep.unknown++;
      if (rep.files.length >= GB_REPORT_CAP) { rep.truncated++; return true; }
      rep.files.push({
        o: outcome,
        // The canonical name wins over the name inside the zip; an unknown has
        // none, so it is shown by its filename -- the only name anyone has.
        n: (row && row.name) || leaf,
        f: leaf,
        i: (row && row.n) ? 1 : 0,      // 1 = that name is the No-Intro name
        d: device || ''                 // set when this site can actually play it
      });
      return true;
    }
    var chain = Promise.resolve();
    entries.forEach(function (e) {
      var len = e.bytes.length;
      chain = chain.then(function () {
        // Game Boy FIRST, and only on a positive hash match — see GB_SIZES.
        // A file is a candidate on its SIZE (the original rule, unchanged) or on
        // a .gb/.gbc/.sgb NAME. The name arm is what lets the index speak about
        // the other few thousand dumps, whose sizes GB_SIZES was never meant to
        // list; it only ever ADDS a hash and a report row, and a non-match still
        // falls through to the classic paths exactly as before.
        /* ATARI CONSOLE FIRMWARE, BY HASH, WHATEVER IT IS CALLED -- before
           anything else, because common BIOS dumps are named .bin and .rom
           ("Atari 7800 BIOS (NTSC).bin", "5200.rom"), the two extensions the
           Atari sink below declines, so a hash it never computed could never
           recognise them. Only files of a firmware LENGTH are hashed here (512,
           2,048, 4,096, 16,384); a hit is filed as firmware and goes no
           further, a miss continues exactly as before. */
        var gbThenRest = function () {
        if (GB_SIZES[len] || GB_EXT.test(e.name)) {
          return sha256hex(e.bytes).then(function (h) {
            var device = gbByHash[h];
            if (device && !gboy[device]) gboy[device] = b64(e.bytes);
            /* CLAIMED, not merely matched.
             *
             * This used to fall through on `!!device` -- a hit in GB_MANIFEST,
             * i.e. one of the twelve catalogue cartridges. Every OTHER Game Boy
             * file went on to identifyRest(), which grabs anything of 131072,
             * 1048576 or 4194304 bytes as colour-unit flash. Those are ordinary
             * cartridge sizes, and in a flat zip every file shares one pairing
             * directory, so the first 128 KiB cartridge in the archive became
             * the twin's INTERNAL ARM FIRMWARE. The twin then reset to PC 0,
             * executed cartridge header bytes, and died at the end of the image
             * with PCLOST -- a black screen on the tile and in the drawer, with
             * nothing anywhere saying why.
             *   The header comment above always warned about this collision and
             * said the hash test is what prevents it. It prevented it only for
             * the twelve; the moment packs could carry arbitrary Game Boy
             * titles, the hole was wide open.
             *   So the question is no longer "is this one of ours" but "is this
             * a Game Boy cartridge at all" -- by manifest, by index, or by
             * extension. Anything the Game Boy pass had an opinion about is
             * consumed here and is never offered to the colour-unit pairing. */
            var claimed = gbClassify(e, h, device, gbRep);
            return !!device || claimed;
          }).then(function (gbMatched) { if (!gbMatched) return identifyRest(e, len); });
        }
        return identifyRest(e, len);
        };
        if (len === 8192) {
          /* The Disk System's drive firmware, by hash only (FDS_BIOS). Anything
             else of this length falls through untouched. */
          return sha256hex(e.bytes).then(function (h) {
            if (FDS_BIOS[h]) {
              if (!fdsBiosFound[h]) fdsBiosFound[h] = { n: String(e.name).replace(/^.*\//, ''), z: len, what: FDS_BIOS[h], b: b64(e.bytes) };
              return;
            }
            return gbThenRest();
          });
        }
        if (ATARI_BIOS_SIZES[len]) {
          return sha256hex(e.bytes).then(function (h) {
            var bios = ATARI_BIOS[h];
            if (bios) { atariRep.checked++; recordAtariBios(h, bios, e, len); return; }
            return gbThenRest();
          });
        }
        return gbThenRest();
      });
    });

    /* ONE FILE'S VERDICT.  Three outcomes, and they are genuinely different:
     *
     *   'g'  known and good — the boot flags pass. If it is also one of the ten
     *        things this site can play it has already been stored above; if it
     *        is not, it is recognised and named and that is all the site can
     *        honestly offer, because there is no tile to play it on.
     *   'b'  known and will not boot — the logo and/or the header checksum fails,
     *        so a real boot program halts. Named, with the reason, and NOT
     *        stored: offering Play on a file the index says will hang would be
     *        the site lying to itself.
     *   'u'  unknown — no hash match. Not a judgement: the reference libraries
     *        are the No-Intro sets, and homebrew and aftermarket titles are
     *        simply not in them.
     *
     * A file that matches nothing AND is not named .gb/.gbc/.sgb produces no row
     * at all. That silence is load-bearing: GB_SIZES overlaps the Pokemon mini
     * (524288) and colour-unit (131072) sizes, so counting every size-candidate
     * as an unknown Game Boy file would report ten "unrecognised cartridges" to
     * anyone whose pack holds their Pokemon mini game files.
     */
    function gbClassify(entry, hash, device, rep) {
      var row = GB_INDEX ? GB_INDEX[hash.slice(0, GB_INDEX_PREFIX)] : null;
      /* FALSE means "not a Game Boy file as far as this pass can tell", and the
         caller uses that to decide whether the colour-unit pairing may have it.
         Everything below returns TRUE: once there is a verdict, the file is a
         cartridge or a boot program and is nobody else's. */
      if (!device && !row && !GB_EXT.test(entry.name)) return false;
      rep.checked++;
      var leaf = String(entry.name).replace(/^.*\//, '');
      var outcome = device ? 'g' : (!row ? 'u' : (row.b ? 'b' : 'g'));
      if (outcome === 'g') rep.good++; else if (outcome === 'b') rep.wontboot++; else rep.unknown++;
      if (rep.files.length >= GB_REPORT_CAP) { rep.truncated++; return true; }
      // A BOOT PROGRAM IS NOT A CARTRIDGE, and the index must not be allowed to
      // speak as if it were. The 2304-byte CGB boot firmware does have an index row —
      // it clears the manifest's 0x150 size threshold, so it was parsed, and its
      // non-existent cartridge header duly failed both boot checks. Reading that
      // row would report the Color boot program as a cartridge that will not
      // boot, under a No-Intro name for a different revision. It is neither.
      var isBoot = !!GB_PART_NAME[device];

      /* KEEP THE BYTES, when this is a cartridge the page could actually play.
       * The catalogue's own eight are already in `gboy`; a boot program is not
       * a cartridge; a file the index says will hang is deliberately NOT kept,
       * for the same reason it is not offered -- see the outcome table above.
       * Anything left is a title this site can put a tile on, and the only
       * reason to refuse it is the budget. */
      if (!device && !isBoot && outcome === 'g' && row) {
        if (gbxCount >= GB_EXTRA_MAX_FILES || gbxBytes + entry.bytes.length > GB_EXTRA_MAX_BYTES) {
          rep.overflow++;
        } else {
          gboyExtra['gb-x' + hash.slice(0, GB_INDEX_PREFIX)] = {
            n: (row.name || leaf), s: row.s, z: entry.bytes.length, b: b64(entry.bytes)
          };
          gbxCount++; gbxBytes += entry.bytes.length; rep.kept++;
        }
      }

      rep.files.push({
        o: outcome,
        // The canonical name wins over whatever the file happens to be called
        // inside the zip. An unknown has no canonical name, so it is shown by
        // its filename — the only name anyone has for it.
        n: isBoot ? GB_PART_NAME[device] : ((row && row.name) || leaf),
        f: leaf,
        r: (!isBoot && row && row.b) || 0, // 0 boots / 1 logo / 2 header cksum / 3 both
        s: (!isBoot && row) ? row.s : -1,  // -1 = no cartridge verdict (unknown, or a boot program)
        i: (!isBoot && row) ? row.n : 0,   // 1 = that name is the No-Intro name
        d: device || ''                    // set when this site can actually play it
      });
      return true;
    }

    function identifyRest(e, len) {
        /* NES, AFTER the Game Boy pass and BEFORE everything below it -- the same
         * position the builder's step 0c takes, and squeezed from both sides for
         * the same two reasons.
         *   Not earlier: the Game Boy pass claims on a sha256 match or a
         * .gb/.gbc/.sgb name, and a hash is a fact about which file this is while
         * a magic number is only a guess about what kind of file it is. A guess
         * must not run ahead of a fact.
         *   Not later: everything below claims on LENGTH and then returns. The
         * colour-unit pairing takes 131072 / 1048576 / 4194304, the Pokemon mini
         * branch takes any 524288-byte file whether it matched or not, and
         * identifyProgramOrSvg takes anything up to MAX_PROGRAM. NES lengths run straight
         * through all of it, so an NES game file that got that far would be swallowed --
         * the same silent drop that put a cartridge in the Mario unit's flash.
         *   Running first steals nothing, because a non-match falls through
         * untouched and nothing else here begins with 4E 45 53 1A. ARM firmware
         * starting with those bytes would declare a stack pointer of 0x1A534E45,
         * which is not word-aligned and so is not ARM firmware either. */
        if (looksLikeInes(e.bytes)) {
          nesRep.checked++;
          if (!inesComplete(e.bytes)) { nesRep.truncated++; return; }
          if (len > NES_CART_MAX_BYTES) { nesRep.overflow++; return; }
          return sha256hex(e.bytes).then(function (h) {
            var key = 'nes-x' + h.slice(0, NES_KEY_PREFIX);
            if (nes[key]) return;
            if (nesCount >= NES_MAX_FILES || nesBytes + len > NES_MAX_BYTES) { nesRep.overflow++; return; }
            nes[key] = {
              n: String(e.name).replace(/^.*\//, '').replace(/\.[^.]*$/, ''),
              z: len,
              m: nesMapper(e.bytes),
              c: nesConsoleOf(e.name, e.bytes),
              b: b64(e.bytes)
            };
            nesCount++; nesBytes += len; nesRep.kept++;
          });
        }
        /* A DISK SYSTEM DISK, beside the cartridges and under the same caps. See
           FDS_SIDE_BYTES above. Content-recognised, so it runs before the length
           branches below for the NES block's reason: 65,500 is not a length any
           of them claims today, but nothing here may depend on that. */
        if (looksLikeFdsDisk(e.bytes)) {
          nesRep.checked++;
          return sha256hex(e.bytes).then(function (h) {
            var key = 'nes-x' + h.slice(0, NES_KEY_PREFIX);
            if (nes[key]) return;
            if (nesCount >= NES_MAX_FILES || nesBytes + len > NES_MAX_BYTES) { nesRep.overflow++; return; }
            nes[key] = {
              n: String(e.name).replace(/^.*\//, '').replace(/\.[^.]*$/, ''),
              z: len, m: 20, c: 'fds', b: b64(e.bytes)
            };
            nesCount++; nesBytes += len; nesRep.kept++;
            nesRep.disks = (nesRep.disks || 0) + 1;
          });
        }
        /* ATARI, immediately after the NES and before every length-based branch
         * below, and the position is argued rather than chosen -- the NES block
         * above sets the rule this follows: a guess must not run ahead of a fact,
         * and nothing may be left to fall through into a branch that claims on
         * length alone.
         *   WHAT CLAIMS HERE IS NOT A GUESS. Two of the three routes are content
         * (the "LYNX" magic and "ATARI7800" at offset 1); the third is an
         * Atari-SPECIFIC extension -- .a26, .a52, .a78, .lnx, .o -- none of which
         * any other sink in this file uses or could want. The genuinely ambiguous
         * extensions, .bin and .rom, are declined here and counted; see ATARI_EXT.
         *   WHY IT MUST BE BEFORE THE LENGTH BRANCHES: a 524,288-byte Lynx
         * cartridge is exactly the Pokemon mini game file length, and a 131,072-byte
         * 7800 cartridge is exactly the colour unit's internal-flash length. Both
         * of those branches take any file of that size and return. An Atari
         * cartridge that reached them would be swallowed -- the same silent drop
         * the NES block records being fixed, which is why this is written down
         * here as well as there rather than left as a matter of ordering nobody
         * can see a reason for. */
        var aKind = atariKindSync(e.bytes, e.name);
        if (!aKind && ATARI_AMBIGUOUS_EXT.test(e.name)) {
          /* Counted, not silently skipped, and NOT claimed: it falls through to
             everything below, so a .bin that really is a Game & Watch firmware file or an
             SVG is still identified by the hash passes that can prove it. */
          atariRep.ambiguous++;
          if (atariRep.ambiguousNames.length < 8) atariRep.ambiguousNames.push(String(e.name).replace(/^.*\//, ''));
        }
        if (aKind) {
          atariRep.checked++;
          return sha256hex(e.bytes).then(function (h) {
            /* BIOS by content hash, then by size -- Get-AtariKind's steps 2 and
               3, in its order. A 2,048-byte .a52 and a 512-byte .lnx/.o cannot be
               a game on their own system (the 5200's smallest cartridge is 4 KB,
               the Lynx's far more), so size is a safe fallback for an unlisted
               dump of the same image and is the only place size decides anything. */
            var bios = ATARI_BIOS[h];
            if (!bios && len === 2048 && atariExtOf(e.name) === '.a52') bios = { s: 'a5200', what: 'Atari 5200 BIOS (unlisted dump)' };
            if (!bios && len === 512 && (atariExtOf(e.name) === '.lnx' || atariExtOf(e.name) === '.o')) bios = { s: 'alynx', what: 'Atari Lynx boot firmware (unlisted dump)' };
            if (bios) { recordAtariBios(h, bios, e, len); return; }
            var cfg = ATARI_SYS[aKind.s];
            if (!cfg || len < cfg.min || len > cfg.max) { atariRep.outOfRange++; return; }
            var key = aKind.s + '-x' + h.slice(0, ATARI_KEY_PREFIX);
            if (atari[key]) return;                       // first copy of a hash wins
            if (atariCount >= ATARI_MAX_FILES || atariBytes + len > ATARI_MAX_BYTES) { atariRep.overflow++; return; }
            atari[key] = {
              s: aKind.s,
              n: String(e.name).replace(/^.*\//, '').replace(/\.[^.]*$/, ''),
              z: len,
              b: b64(e.bytes)
            };
            atariCount++; atariBytes += len; atariRep.kept++;
            if (aKind.how === 'magic') atariRep.byMagic++;
            else if (aKind.how === 'content') atariRep.byContent = (atariRep.byContent || 0) + 1;
            else atariRep.byExtension++;
          });
        }
        if (len === TFT.internal || len === TFT.mario || len === TFT.zelda) {
          var dir = e.name.replace(/[^/]*$/, '');       // parent path = pairing container
          var g = groups[dir] || (groups[dir] = {});
          /* Only a file that is actually ARM firmware may become `internal`.
             Belt and braces with the Game Boy claim above: that stops cartridges
             this site recognises, this stops anything else of the same size. */
          if (len === TFT.internal) { if (!g.internal && looksLikeArmFirmware(e.bytes)) g.internal = e.bytes; }
          else if (len === TFT.mario) { if (!g.mario) g.mario = e.bytes; }
          else if (!g.zelda) { g.zelda = e.bytes; }
          return;
        }
        // Pokemon mini game file/BIOS (whole-file hash). A matched 512 KB or 4 KB file
        // is stored here; an unmatched 512 KB file is not a firmware/SVG candidate, so
        // it stops. An unmatched 4 KB file falls through to the classic paths.
        var pmCheck = (len === PM_CART || len === PM_BIOS || PM_EXT.test(e.name))
          ? sha256hex(e.bytes).then(function (h) {
              var dev = pmByHash[h];
              if (dev && !pmini[dev]) pmini[dev] = b64(e.bytes);
              /* Say something about it either way. A file this site cannot play
                 is still a file the person put in the zip, and silence is the
                 one answer that helps nobody. */
              var claimed = pmClassify(e, h, dev, pmRep);
              return !!dev || claimed;
            })
          : Promise.resolve(false);
        return pmCheck.then(function (pmMatched) {
          if (pmMatched || len === PM_CART) return;
          return identifyProgramOrSvg(e, len);
        });
    }

    // classic firmware (with truncation fallback) then SVG whole-file hash
    function identifyProgramOrSvg(e, len) {
        if (len === 0 || len > MAX_SVG) return;
        var tryLens = [len];                            // Firmware: try real length, then smaller known
        if (len <= MAX_PROGRAM) for (var j = 0; j < knownLens.length; j++) if (knownLens[j] < len) tryLens.push(knownLens[j]);
        return (function tryProgram(i) {
          if (i >= tryLens.length || len > MAX_PROGRAM) return Promise.resolve(false);
          var tl = tryLens[i];
          return sha256hex(e.bytes.subarray(0, tl)).then(function (h) {
            if (programByHash[h]) {
              programByHash[h].forEach(function (row) {
                var d = fw[row.device] || (fw[row.device] = {});
                if (!d[row.part]) d[row.part] = b64(e.bytes.subarray(0, tl));
              });
              return true;
            }
            return tryProgram(i + 1);
          });
        })(0).then(function (matched) {
          if (matched) return;
          return sha256hex(e.bytes).then(function (h) {  // SVG: whole-file hash
            if (svgByHash[h] && !art[svgByHash[h]]) art[svgByHash[h]] = utf8(e.bytes);
          });
        });
    }

    return chain.then(function () {
      var tft = {};
      Object.keys(groups).forEach(function (dir) {
        var g = groups[dir];
        if (!g.internal) return;
        if (g.mario && !tft.mario) tft.mario = { internal: b64(g.internal), external: b64(g.mario) };
        else if (g.zelda && !tft.zelda) tft.zelda = { internal: b64(g.internal), external: b64(g.zelda) };
      });
      /* `scan` is the truncation verdict from readZip, stored WITH the pack so a
         pack opened on an earlier visit still reports that it was truncated --
         the same reason gbRep/pmRep are carried. A pack that was cut short must
         never read as a complete one, at import or a month later. */
      var scan = (_scan && (_scan.depthCapHits || _scan.byteCapHit))
               ? { depthCapHits: _scan.depthCapHits, byteCapHit: _scan.byteCapHit,
                   depthLimit: _scan.depthLimit, byteLimit: _scan.byteLimit }
               : null;
      return { programs: fw, art: art, tft: tft, pokemini: pmini, gameboy: gboy,
               gameboyExtra: gboyExtra, nes: nes, nesReport: nesRep,
               atari: atari, atariBios: atariBiosFound, atariReport: atariRep,
               fdsBios: fdsBiosFound,
               gb: gbRep, pm: pmRep, scan: scan };
    });
  }

  // --- what a pack covers, for the Settings summary ---------------------------
  function summarize(pack) {
    /* A device written key~variant (8 Nov 2026: Helmet CN-07, Judge IP-15) is another program
       revision of that device, chosen in its drawer, never a device of its own: not counted. */
    var programDevices = {}; GNW_MANIFEST.forEach(function (r) { if (r.part === 'program' && r.device.indexOf('~') < 0) programDevices[r.device] = 1; });
    var allPrograms = Object.keys(programDevices);
    var havePrograms = allPrograms.filter(function (d) { return pack.programs[d] && pack.programs[d].program; });
    var allArt = SVG_MANIFEST.map(function (s) { return s.path; });
    var haveArt = allArt.filter(function (p) { return pack.art[p]; });
    /* Count only units whose firmware would actually RUN. A pack built before
       the size-collision fix carries a Game Boy cartridge where the colour
       unit's ARM firmware should be; applyToPage() refuses it, so reporting it
       here as a found unit would tell the user the opposite of what the page is
       doing -- "2 of 2" beside two dead tiles. `rejectedTft` is what makes the
       difference between "this pack has no colour firmware" and "this pack has
       the wrong bytes and needs re-importing" visible. */
    var allTft = Object.keys(pack.tft || {});
    var haveTft = allTft.filter(function (u) {
      var bytes = null;
      try { bytes = b64ToBytes(pack.tft[u] && pack.tft[u].internal); } catch (e) {}
      return looksLikeArmFirmware(bytes);
    });
    var rejectedTft = allTft.filter(function (u) { return haveTft.indexOf(u) < 0; });
    var pm = pack.pokemini || {};
    var allPm = PM_MANIFEST.filter(function (p) { return p.device !== 'bios'; }).map(function (p) { return p.device; });
    var havePm = allPm.filter(function (d) { return pm[d]; });
    var pmBios = !!pm.bios;
    var gb = pack.gameboy || {};
    var allGb = GB_MANIFEST.filter(function (g) { return g.device.indexOf('bios') !== 0; }).map(function (g) { return g.device; });
    var haveGb = allGb.filter(function (d) { return gb[d]; });
    var gbBios = !!gb.bios;
    var gbExtra = pack.gameboyExtra || {};
    var gbExtraIds = Object.keys(gbExtra);
    /* NES. `found` with no `total` beside it, because there is no catalogue to be
       short of: the count IS the total, and printing "12 / 12" would invent a
       completeness the NES shelf does not have. A pack built before the NES sink
       existed simply has no `nes`, which reads as zero and not as an error. */
    var nes = pack.nes || {};
    var nesIds = Object.keys(nes);
    var nesRep = pack.nesReport || null;
    var atariMap = pack.atari || {};
    var atariIds = Object.keys(atariMap);
    var atariRep = pack.atariReport || null;
    var atariBiosIds = Object.keys(pack.atariBios || {});
    var atariBySystem = {};
    atariIds.forEach(function (k) { var s = atariMap[k].s || 'unknown'; atariBySystem[s] = (atariBySystem[s] || 0) + 1; });
    // The verdict sheet from identify(), carried through so the Settings panel
    // can report a pack it opened on an earlier visit and not just this import.
    // Older packs (imported before the index existed) simply have no `gb`.
    var gbRep = pack.gb || null;
    var pmRep = pack.pm || null;
    return {
      // Null unless a cap fired. Present = this pack is INCOMPLETE and every
      // count below it is a floor, not a total. Surfaced by fmt() in index.html
      // and by the banner in gnw.js -- and it is reported even when `empty` is
      // true, because "nothing recognised" and "we stopped looking" are not the
      // same answer and a zip bomb produces both at once.
      scan: pack.scan || null,
      gameboy: { found: haveGb.length, total: allGb.length, bios: gbBios, biosCgb: !!gb.biosCgb, report: gbRep,
                 missing: allGb.filter(function (d) { return haveGb.indexOf(d) < 0; }),
                 // Titles beyond the catalogue that this pack made playable.
                 extra: gbExtraIds.length,
                 extraNames: gbExtraIds.map(function (k) { return gbExtra[k].n; }).sort() },
      // Named as well as counted, for the same reason gameboy.extraNames is: a
      // content-derived title has no catalogue entry, so the list of names IS the
      // only description of what this pack made playable.
      nes: { found: nesIds.length, report: nesRep,
             names: nesIds.map(function (k) { return nes[k].n; }).sort(),
             mappers: nesIds.map(function (k) { return nes[k].m; })
                            .filter(function (v, i, a) { return a.indexOf(v) === i; })
                            .sort(function (a, b) { return a - b; }) },
      /* ATARI. `found` with no `total`, for the NES's reason: there is no Atari
         catalogue to be short of, so the count IS the total and "307 / 307" would
         invent a completeness this shelf does not have. Split PER MACHINE as well
         as totalled, because they are four shelves and a visitor who imported 300
         Lynx cartridges and no 2600 ones must not read one number and conclude the
         2600 arrived. A pack built before this sink existed simply has no `atari`,
         which reads as zero and not as an error. */
      atari: { found: atariIds.length, report: atariRep, bios: atariBiosIds.length,
               bySystem: atariBySystem,
               names: atariIds.map(function (k) { return atariMap[k].n; }).sort() },
      programs: { found: havePrograms.length, total: allPrograms.length, missing: allPrograms.filter(function (d) { return havePrograms.indexOf(d) < 0; }) },
      art: { found: haveArt.length, total: allArt.length },
      tft: { found: haveTft.length, total: 2, units: haveTft,
             // Named so the Settings panel can say WHY a unit is missing.
             rejected: rejectedTft },
      pokemini: { found: havePm.length, total: allPm.length, bios: pmBios,
                  missing: allPm.filter(function (d) { return havePm.indexOf(d) < 0; }),
                  // What the pack held BEYOND the ten, named by hash.
                  report: pmRep },
      // "Nothing recognised" must NOT swallow a zip whose only Game Boy files
      // were rejected: a pack of 62 Sachen carts has produced no playable
      // content and a page of warnings the user needs to read, and those are not
      // the same state. Any file the Game Boy pass had an opinion about counts.
      // An NES pass that had an opinion counts too: a zip of nothing but truncated
      // .nes dumps has produced no playable content and a warning the user needs to
      // read, and calling that "nothing recognised" hides the one fact that would
      // let them fix it.
      empty: havePrograms.length === 0 && haveArt.length === 0 && haveTft.length === 0
             && rejectedTft.length === 0 && havePm.length === 0 && !pmBios
             && haveGb.length === 0 && !gbBios && !gb.biosCgb && !(gbRep && gbRep.checked)
             && gbExtraIds.length === 0 && !(pmRep && pmRep.checked)
             && nesIds.length === 0 && !(nesRep && nesRep.checked)
             /* ATARI BELONGS IN THIS TEST, and leaving it out is exactly the
                half-a-feature this sink was asked not to be: a zip holding four
                2600 cartridges and nothing else would have reported "that zip
                didn't contain any recognised content" while the four were sitting
                in the pack, catalogued and playable. `checked` is included beside
                the count for the reason it is for the NES and the Game Boy -- a
                pack whose Atari files were all looked at and all declined is a
                pack this panel has something to SAY about, and saying nothing is
                what sends someone to look for a bug in the import. */
             && atariIds.length === 0 && atariBiosIds.length === 0
             && !(atariRep && atariRep.checked) && !(atariRep && atariRep.ambiguous)
    };
  }

  // --- IndexedDB (single record holding the assembled pack) -------------------
  var DB = 'gnwContentPack', STORE = 'pack', KEY = 'current';
  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbGet() { return openDb().then(function (db) { return new Promise(function (res, rej) { var q = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }); }
  function idbPut(v) { return openDb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, KEY); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }); }
  function idbDel() { return openDb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(KEY); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }); }

  // --- feed the colour-unit firmware to the MAIN-THREAD twin (tiles / drawer);
  //     the play-window worker asks for it separately (see twin-worker.js). -----
  var _pack = null;
  function applyToPage(pack) {
    if (!pack || !pack.tft) return;
    window.__ARM_FW = window.__ARM_FW || {};
    for (var u in pack.tft) {
      if (window.__ARM_FW[u]) continue;
      /* CHECKED ON THE WAY OUT, NOT ONLY ON THE WAY IN.
         A pack imported before the pairing was fixed is already in IndexedDB
         with a cartridge where its firmware should be, and re-importing is the
         only real repair -- but publishing the bad bytes would reproduce the
         silent black screen every visit until someone did. So it is validated
         here too, and a failure says exactly what happened and what to do. */
      var fw = pack.tft[u], bytes = null;
      try { bytes = b64ToBytes(fw && fw.internal); } catch (e) {}
      if (!looksLikeArmFirmware(bytes)) {
        console.warn('[content pack] the ' + u + ' colour unit\'s internal firmware in this pack is not ' +
                     'ARM firmware (it looks like a Game Boy cartridge, which is the same size). ' +
                     'This pack was built before that collision was fixed \u2014 re-open your content ' +
                     'pack in Settings \u2192 Content to repair it. The unit is disabled until then.');
        continue;
      }
      window.__ARM_FW[u] = fw;
    }
  }

  /* base64 -> bytes, for the validation above. The pack stores everything
     base64'd; this is the only place the loader needs it back. */
  function b64ToBytes(b64) {
    if (!b64) return null;
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  // Load any stored pack up front; gnw.js awaits this before falling back to it.
  /* A pack stored before 24 Oct 2026 holds the Game & Watch programs under older key
     names (one for the map, one for each unit's program). Read it as the new ones,
     so a pack people already made keeps working without being opened again. */
  function upgradeStoredPack(p) {
    if (!p || p.programs || !p.roms) return p;
    var out = {};
    for (var d in p.roms) {
      var e = p.roms[d] || {}, n = {};
      for (var k in e) n[k === 'rom' ? 'program' : k] = e[k];
      out[d] = n;
    }
    p.programs = out; delete p.roms;
    return p;
  }
  /* SWITCHED OFF (28 Oct; source-switch.js): the content pack's switch in Settings is
     off. The pack stays stored and held (_packKept) but reads as closed (_pack null) to every
     caller, so its titles, firmware and artwork are not used; on again, it is back at once. */
  var _packKept = null;
  function packOff() { try { return !!(window.CwSources && !window.CwSources.on('pack')); } catch (e) { return false; } }
  var ready = idbGet().then(function (p) { p = upgradeStoredPack(p); _packKept = p; _pack = packOff() ? null : p; applyToPage(_pack); return _pack; })
    .catch(function () { _pack = null; return null; });
  window.addEventListener('cw:source-switch', function (e) {
    if (!e || !e.detail || e.detail.id !== 'pack') return;
    ready.then(function () {
      if (e.detail.on) { _pack = _packKept; applyToPage(_pack); }
      else {
        _pack = null;
        // Only the colour-unit firmware this pack put there goes (the site's own files stay).
        try { var t = (_packKept && _packKept.tft) || {}; for (var u in t) if (window.__ARM_FW && window.__ARM_FW[u] === t[u]) delete window.__ARM_FW[u]; } catch (x) {}
      }
      if (typeof reloadAllGameContent === 'function') { try { reloadAllGameContent(); } catch (x) {} }
    });
  });

  window.__GNW_PACK = {
    ready: ready,
    has: function () { return !!_pack; },
    // A pack is stored, even while its switch in Settings is off: for the Settings tile.
    kept: function () { return !!_packKept; },
    switchedOff: function () { return !!_packKept && packOff(); },
    programs: function () { return _pack && _pack.programs; },
    art: function () { return _pack && _pack.art; },
    tft: function (u) { return _pack && _pack.tft && _pack.tft[u]; },
    // Pokemon mini: whole map ({id:b64, bios:b64}) or one id's base64. The main
    // frontend lazy-loads firmware/output/pokemini_games.json first; this is the fallback.
    pokemini: function (id) { var pm = _pack && _pack.pokemini; if (!pm) return null; return id ? pm[id] : pm; },
    // Game Boy: whole map ({'gb-<slot>':b64, bios:b64}) or one device id's base64.
    // The catalogue tries the local /carts/ mount first; this is the fallback,
    // and on a public deploy (no /carts/) it is the ONLY source. Same shape and
    // same contract as pokemini() above — see ADDING_A_CATALOGUE.md §11.4.
    // Game Boy: whole map or one device id's base64. The catalogue's eight and
    // the pack's own extra titles answer through the SAME call -- a caller that
    // has an id does not need to know which kind of title it is holding, which
    // is the whole reason the extras are keyed 'gb-<slot>' as well.
    gameboy: function (id) {
      var gb = _pack && _pack.gameboy, x = _pack && _pack.gameboyExtra;
      if (!id) return gb || null;                      // whole map = the eight, unchanged
      if (gb && gb[id]) return gb[id];
      return (x && x[id]) ? x[id].b : null;
    },
    // The extra titles as {id: {n, s, z}} -- NAMES AND SIZES, NO BYTES. This is
    // what the Game Boy page reads to build tiles, and it is deliberately a
    // different call from gameboy(): building a catalogue must not require
    // holding every cartridge in the page at once.
    gameboyExtra: function () {
      var x = _pack && _pack.gameboyExtra;
      if (!x) return null;
      var out = {};
      for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) {
        out[k] = { n: x[k].n, s: x[k].s, z: x[k].z };
      }
      return out;
    },
    // NES: one id's base64, or the whole map of base64 with no argument. That is
    // gameboy()'s contract rather than gameboyExtra()'s, and the choice matters
    // because the stored records are objects: a caller holding an id wants the
    // game file, not a wrapper it has to reach into, and the no-argument form has to
    // answer in the same currency or the two shapes of one call disagree. The
    // firmware/output/nes_games.json the builder bakes is read through this same call, so
    // an imported pack and a baked build are indistinguishable to the NES page.
    nes: function (id) {
      var n = _pack && _pack.nes;
      if (!n) return null;
      if (id) return n[id] ? n[id].b : null;
      var out = {};
      for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) out[k] = n[k].b;
      return out;
    },
    // The NES titles as {id: {n, z, m}} -- NAMES, SIZES AND MAPPERS, NO BYTES,
    // which is exactly what firmware/output/nes_manifest.json holds. A different call
    // from nes() for the reason gameboyExtra() is a different call from gameboy():
    // building a shelf of tiles must not mean holding every game file in the page at
    // once, and the whole point of the manifest split is that it never has to.
    nesManifest: function () {
      var n = _pack && _pack.nes;
      if (!n) return null;
      var out = {};
      for (var k in n) if (Object.prototype.hasOwnProperty.call(n, k)) {
        out[k] = { n: n[k].n, z: n[k].z, m: n[k].m };
        if (n[k].c) out[k].c = n[k].c;          /* nes / famicom / fds -- see FDS_SIDE_BYTES */
      }
      return out;
    },
    /* ATARI: one id's base64, or the whole map of base64 with no argument --
       nes()'s contract exactly, and for nes()'s reason: a caller holding an id
       wants the cartridge, not a wrapper it has to reach into, and the
       no-argument form has to answer in the same currency or the two shapes of
       one call disagree. index.html's _atariFetchCart() reads
       firmware/output/atari<sys>_games.json through the same shape, so an imported pack
       and a baked build are indistinguishable to the catalogue. */
    atari: function (id) {
      var a = _pack && _pack.atari;
      if (!a) return null;
      if (id) return a[id] ? a[id].b : null;
      var out = {};
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k].b;
      return out;
    },
    /* The Atari titles as {id: {s, n, z}} -- MACHINE, NAME AND SIZE, NO BYTES,
       which is exactly what firmware/output/atari_manifest.json's `titles` holds. A
       different call from atari() for the reason nesManifest() is a different
       call from nes(): building a shelf of two thousand tiles must not mean
       holding two thousand cartridges in the page at once, and the whole point of
       the manifest split is that it never has to. */
    /* The user's console firmware from the open pack, {sha256: {s, n, z, what,
       b}}, or null -- firmware/output/atari_bios.json's shape exactly, so index.html
       reads a pack and a baked build through one path. */
    /* The Disk System's drive firmware from the open pack, as base64, or null.
       Any of the known images will do; the first found is given. */
    fdsBios: function () {
      var f = _pack && _pack.fdsBios;
      if (!f) return null;
      for (var k in f) if (Object.prototype.hasOwnProperty.call(f, k) && f[k].b) return f[k].b;
      return null;
    },
    atariBios: function () {
      var a = _pack && _pack.atariBios;
      if (!a) return null;
      var out = {}, any = false;
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k) && a[k].b) { out[k] = a[k]; any = true; }
      return any ? out : null;
    },
    atariManifest: function () {
      var a = _pack && _pack.atari;
      if (!a) return null;
      var out = {};
      for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) {
        out[k] = { s: a[k].s, n: a[k].n, z: a[k].z };
      }
      return out;
    },
    /* Which catalogue entry a whole-file SHA-256 is, from the same identity
       manifests a pack import uses: {kind:'gb'|'pm'|'gnw', device, part?} or
       null. Read by cws.js so a game-server cartridge lands on the catalogue's
       own id (pm-<slug>; Game Boy rows are boot programs only since
       2026-10-12) instead of a second tile. No bytes here. */
    /* Game Boy class by identity (2026-10-14): the index's header
       class for a SHA-256 prefix -- 0 dmg / 1 cgb-enhanced / 2 cgb-only, read
       from $0143 when the index was built -- or null when the index does not
       know it. gbIndexReady() loads the index (once, ~88 KB) and never rejects.
       index.html uses it so a game server's title sits on the shelf its header
       says, not the folder it was filed in. */
    gbIndexReady: function () { return loadGbIndex(); },
    gbClass: function (sha256) {
      if (!GB_INDEX) return null;
      var row = GB_INDEX[String(sha256 || '').toLowerCase().slice(0, GB_INDEX_PREFIX)];
      return row ? row.s : null;
    },
    identify: function (sha256) {
      var h = String(sha256 || '').toLowerCase(), i;
      for (i = 0; i < GB_MANIFEST.length; i++) if (GB_MANIFEST[i].sha256 === h) return { kind: 'gb', device: GB_MANIFEST[i].device };
      for (i = 0; i < PM_MANIFEST.length; i++) if (PM_MANIFEST[i].sha256 === h) return { kind: 'pm', device: PM_MANIFEST[i].device };
      for (i = 0; i < GNW_MANIFEST.length; i++) if (GNW_MANIFEST[i].sha256 === h) return { kind: 'gnw', device: GNW_MANIFEST[i].device, part: GNW_MANIFEST[i].part };
      return null;
    },
    /* Game & Watch: every catalogue device a file is, by the rule a pack
       import uses (identifyProgramOrSvg): the whole file, then each shorter known
       length, for dumps padded out to a round size. One dump can serve several
       devices (a reissue, a tabletop and its panorama twin), so this answers
       all of them: [{device, part, bytes}] where `bytes` is the length that
       matched, or []. Read by cws.js for device zips from a game server
       (2026-10-12). No bytes in the answer. */
    gnwMatch: function (u8) {
      var len = u8 ? u8.length : 0;
      if (!len || len > MAX_PROGRAM) return Promise.resolve([]);
      var lens = [len];
      GNW_MANIFEST.forEach(function (r) { if (r.bytes < len && lens.indexOf(r.bytes) < 0) lens.push(r.bytes); });
      lens = [len].concat(lens.slice(1).sort(function (a, b) { return b - a; }));
      return (function next(i) {
        if (i >= lens.length) return Promise.resolve([]);
        return sha256hex(u8.subarray(0, lens[i])).then(function (h) {
          var rows = GNW_MANIFEST.filter(function (r) { return r.sha256 === h; });
          if (!rows.length) return next(i + 1);
          return rows.map(function (r) { return { device: r.device, part: r.part, bytes: lens[i] }; });
        });
      })(0);
    },
    summary: function () { return _pack ? summarize(_pack) : null; },
    // The .zip reader alone, for a file played from Settings > Play a file (play-file.js):
    // [{name, bytes}], nothing identified, stored or kept.
    readZip: function (buf) { return readZip(buf); },
    // Import a user-picked .zip: parse → identify → persist → apply. Resolves
    // with the summary; rejects if the file isn't a readable zip.
    importZip: function (file) {
      // The Game Boy index is fetched HERE and nowhere else: a visitor who never
      // opens a content pack never pays the 88 KB, and identify() is guaranteed
      // to have it (or to have learned it is unavailable) before it hashes a
      // byte. loadGbIndex() never rejects, so a missing index cannot turn a
      // perfectly good import into a failure.
      // Both indexes are fetched HERE and nowhere else: a visitor who never
      // opens a content pack pays for neither. Together they are ~89 KB.
      return Promise.all([loadGbIndex(), loadPmIndex()])
        .then(function () { return file.arrayBuffer(); })
        .then(readZip).then(identify).then(function (pack) {
          // Opening a pack is wanting it: a switch left off goes on.
          try { if (packOff()) window.CwSources.set('pack', true, true); } catch (x) {}
          return idbPut(pack).then(function () { _pack = pack; _packKept = pack; applyToPage(pack); return summarize(pack); });
        });
    },
    clear: function () {
      // Fully unload the pack so NOTHING survives a "close pack" — the colour-unit
      // (Mario/Zelda) firmware included. Three places hold it: the in-memory _pack
      // (play-window worker asks for it via .tft()), the applied window.__ARM_FW
      // (what the tiles/drawer boot from), and the persisted IndexedDB record.
      _pack = null; _packKept = null;
      try { window.__ARM_FW = {}; } catch (e) {}
      return openDb().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction(STORE, 'readwrite');
          t.objectStore(STORE).clear();               // wipe ALL records, not just KEY 'current'
          t.oncomplete = function () { res(); };
          t.onerror = function () { rej(t.error); };
        });
      }).catch(function () {});
    }
  };
})();
