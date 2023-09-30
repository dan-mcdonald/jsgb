BOOT:0000 31 FE FF         ld   sp,FFFE
BOOT:0003 AF               xor  a
BOOT:0004 21 FF 9F         ld   hl,9FFF
BOOT:0007 32               ldd  (hl),a
BOOT:0008 CB 7C            bit  7,h
BOOT:000A 20 FB            jr   nz,0007
BOOT:000C 21 26 FF         ld   hl,FF26
BOOT:000F 0E 11            ld   c,11
BOOT:0011 3E 80            ld   a,80
BOOT:0013 32               ldd  (hl),a
BOOT:0014 E2               ld   (ff00+c),a
BOOT:0015 0C               inc  c
BOOT:0016 3E F3            ld   a,F3
BOOT:0018 E2               ld   (ff00+c),a
BOOT:0019 32               ldd  (hl),a
BOOT:001A 3E 77            ld   a,77
BOOT:001C 77               ld   (hl),a
BOOT:001D 3E FC            ld   a,FC
BOOT:001F E0 47            ld   (ff00+47),a
BOOT:0021 11 04 01         ld   de,0104
BOOT:0024 21 10 80         ld   hl,8010
BOOT:0027 1A               ld   a,(de)
BOOT:0028 CD 95 00         call 0095
BOOT:002B CD 96 00         call 0096
BOOT:002E 13               inc  de
BOOT:002F 7B               ld   a,e
BOOT:0030 FE 34            cp   a,34
BOOT:0032 20 F3            jr   nz,0027
BOOT:0034 11 D8 00         ld   de,00D8
BOOT:0037 06 08            ld   b,08
BOOT:0039 1A               ld   a,(de)
BOOT:003A 13               inc  de
BOOT:003B 22               ldi  (hl),a
BOOT:003C 23               inc  hl
BOOT:003D 05               dec  b
BOOT:003E 20 F9            jr   nz,0039
BOOT:0040 3E 19            ld   a,19
BOOT:0042 EA 10 99         ld   (9910),a
BOOT:0045 21 2F 99         ld   hl,992F
BOOT:0048 0E 0C            ld   c,0C
BOOT:004A 3D               dec  a
BOOT:004B 28 08            jr   z,0055
BOOT:004D 32               ldd  (hl),a
BOOT:004E 0D               dec  c
BOOT:004F 20 F9            jr   nz,004A
BOOT:0051 2E 0F            ld   l,0F
BOOT:0053 18 F3            jr   0048
BOOT:0055 67               ld   h,a
BOOT:0056 3E 64            ld   a,64
BOOT:0058 57               ld   d,a
BOOT:0059 E0 42            ld   (ff00+42),a
BOOT:005B 3E 91            ld   a,91
BOOT:005D E0 40            ld   (ff00+40),a
BOOT:005F 04               inc  b
BOOT:0060 1E 02            ld   e,02
BOOT:0062 0E 0C            ld   c,0C
BOOT:0064 F0 44            ld   a,(ff00+44)
BOOT:0066 FE 90            cp   a,90
BOOT:0068 20 FA            jr   nz,0064
BOOT:006A 0D               dec  c
BOOT:006B 20 F7            jr   nz,0064
BOOT:006D 1D               dec  e
BOOT:006E 20 F2            jr   nz,0062
BOOT:0070 0E 13            ld   c,13
BOOT:0072 24               inc  h
BOOT:0073 7C               ld   a,h
BOOT:0074 1E 83            ld   e,83
BOOT:0076 FE 62            cp   a,62
BOOT:0078 28 06            jr   z,0080
BOOT:007A 1E C1            ld   e,C1
BOOT:007C FE 64            cp   a,64
BOOT:007E 20 06            jr   nz,0086
BOOT:0080 7B               ld   a,e
BOOT:0081 E2               ld   (ff00+c),a
BOOT:0082 0C               inc  c
BOOT:0083 3E 87            ld   a,87
BOOT:0085 E2               ld   (ff00+c),a
BOOT:0086 F0 42            ld   a,(ff00+42)
BOOT:0088 90               sub  b
BOOT:0089 E0 42            ld   (ff00+42),a
BOOT:008B 15               dec  d
BOOT:008C 20 D2            jr   nz,0060
BOOT:008E 05               dec  b
BOOT:008F 20 4F            jr   nz,00E0
BOOT:0091 16 20            ld   d,20
BOOT:0093 18 CB            jr   0060
BOOT:0095 4F               ld   c,a
BOOT:0096 06 04            ld   b,04
BOOT:0098 C5               push bc
BOOT:0099 CB 11            rl   c
BOOT:009B 17               rla  
BOOT:009C C1               pop  bc
BOOT:009D CB 11            rl   c
BOOT:009F 17               rla  
BOOT:00A0 05               dec  b
BOOT:00A1 20 F5            jr   nz,0098
BOOT:00A3 22               ldi  (hl),a
BOOT:00A4 23               inc  hl
BOOT:00A5 22               ldi  (hl),a
BOOT:00A6 23               inc  hl
BOOT:00A7 C9               ret  
BOOT:00E0 21 04 01         ld   hl,0104
BOOT:00E3 11 A8 00         ld   de,00A8
BOOT:00E6 1A               ld   a,(de)
BOOT:00E7 13               inc  de
BOOT:00E8 BE               cp   (hl)
BOOT:00E9 20 FE            jr   nz,00E9
BOOT:00EB 23               inc  hl
BOOT:00EC 7D               ld   a,l
BOOT:00ED FE 34            cp   a,34
BOOT:00EF 20 F5            jr   nz,00E6
BOOT:00F1 06 19            ld   b,19
BOOT:00F3 78               ld   a,b
BOOT:00F4 86               add  (hl)
BOOT:00F5 23               inc  hl
BOOT:00F6 05               dec  b
BOOT:00F7 20 FB            jr   nz,00F4
BOOT:00F9 86               add  (hl)
BOOT:00FA 20 FE            jr   nz,00FA
BOOT:00FC 3E 01            ld   a,01
BOOT:00FE E0 50            ld   (ff00+50),a
ROM0:0100 00               nop  
ROM0:0101 C3 50 01         jp   0150
ROM0:0150 CD 81 28         call 2881
ROM0:0153 31 FF DF         ld   sp,DFFF
ROM0:0156 AF               xor  a
ROM0:0157 E0 47            ld   (ff00+47),a
ROM0:0159 E0 48            ld   (ff00+48),a
ROM0:015B E0 49            ld   (ff00+49),a
ROM0:015D 21 00 80         ld   hl,8000
ROM0:0160 01 00 18         ld   bc,1800
ROM0:0163 CD 99 29         call 2999
ROM0:0166 CD A8 28         call 28A8
ROM0:0169 CD 8A 29         call 298A
ROM0:016C 3E 01            ld   a,01
ROM0:016E EA 00 21         ld   (2100),a
ROM0:0171 CD 19 7D         call 7D19
ROM0:0174 CD C0 FF         call FFC0
ROM0:0177 CD CE 40         call 40CE
ROM0:017A CD 6B 2B         call 2B6B
ROM0:017D 3E 44            ld   a,44
ROM0:017F E0 41            ld   (ff00+41),a
ROM0:0181 3E 4F            ld   a,4F
ROM0:0183 E0 45            ld   (ff00+45),a
ROM0:0185 3E 01            ld   a,01
ROM0:0187 EA AF DB         ld   (DBAF),a
ROM0:018A 3E 01            ld   a,01
ROM0:018C E0 FF            ld   (ff00+FF),a
ROM0:018E 3E 01            ld   a,01
ROM0:0190 EA 00 21         ld   (2100),a
ROM0:0193 CD 0F 46         call 460F
ROM0:0196 3E 1F            ld   a,1F
ROM0:0198 EA 00 21         ld   (2100),a
ROM0:019B CD 00 40         call 4000
ROM0:019E 3E 18            ld   a,18
ROM0:01A0 E0 B5            ld   (ff00+B5),a
ROM0:01A2 FB               ei   
ROM0:01A3 C3 BD 03         jp   03BD
ROM0:2881 F0 FF            ld   a,(ff00+FF)
ROM0:2883 E0 D2            ld   (ff00+D2),a
ROM0:2885 CB 87            res  0,a
ROM0:2887 F0 44            ld   a,(ff00+44)
ROM0:2889 FE 91            cp   a,91
ROM0:288B 20 FA            jr   nz,2887
ROM0:288D F0 40            ld   a,(ff00+40)
ROM0:288F E6 7F            and  a,7F
ROM0:2891 E0 40            ld   (ff00+40),a
ROM0:2893 F0 D2            ld   a,(ff00+D2)
ROM0:2895 E0 FF            ld   (ff00+FF),a
ROM0:2897 C9               ret  
ROM0:2999 AF               xor  a
ROM0:299A 22               ldi  (hl),a
ROM0:299B 0B               dec  bc
ROM0:299C 78               ld   a,b
ROM0:299D B1               or   c
ROM0:299E 20 F9            jr   nz,2999
ROM0:29A0 C9               ret  
ROM0:28A8 3E 7F            ld   a,7F
ROM0:28AA 01 00 08         ld   bc,0800
ROM0:28AD 57               ld   d,a
ROM0:28AE 21 00 98         ld   hl,9800
ROM0:28B1 7A               ld   a,d
ROM0:28B2 22               ldi  (hl),a
ROM0:28B3 0B               dec  bc
ROM0:28B4 78               ld   a,b
ROM0:28B5 B1               or   c
ROM0:28B6 20 F9            jr   nz,28B1
ROM0:28B8 C9               ret  
ROM1:7D19 0E C0            ld   c,C0
ROM1:7D1B 06 0A            ld   b,0A
ROM1:7D1D 21 27 7D         ld   hl,7D27
ROM1:7D20 2A               ldi  a,(hl)
ROM1:7D21 E2               ld   (ff00+c),a
ROM1:7D22 0C               inc  c
ROM1:7D23 05               dec  b
ROM1:7D24 20 FA            jr   nz,7D20
ROM1:7D26 C9               ret  
ROM0:28C5 2A               ldi  a,(hl)
ROM0:28C6 12               ld   (de),a
ROM0:28C7 13               inc  de
ROM0:28C8 0B               dec  bc
ROM0:28C9 78               ld   a,b
ROM0:28CA B1               or   c
ROM0:28CB 20 F8            jr   nz,28C5
ROM0:28CD C9               ret  
ROM1:46DD 0E 01            ld   c,01
ROM1:46DF 06 05            ld   b,05
ROM1:46E1 21 00 A1         ld   hl,A100
ROM1:46E4 19               add  hl,de
ROM1:46E5 CD B5 27         call 27B5
ROM1:46E8 2A               ldi  a,(hl)
ROM1:46E9 B9               cp   c
ROM1:46EA 20 07            jr   nz,46F3
ROM1:46EC 0C               inc  c
ROM1:46ED 0C               inc  c
ROM1:46EE 05               dec  b
ROM1:46EF 20 F4            jr   nz,46E5
ROM1:46F1 18 1D            jr   4710
ROM1:46F3 21 00 A1         ld   hl,A100
ROM1:46F6 19               add  hl,de
ROM1:46F7 3E 01            ld   a,01
ROM1:46F9 CD B5 27         call 27B5
ROM1:46FC 22               ldi  (hl),a
ROM1:46FD 3C               inc  a
ROM1:46FE 3C               inc  a
ROM1:46FF FE 0B            cp   a,0B
ROM1:4701 38 F6            jr   c,46F9
ROM1:4703 11 80 03         ld   de,0380
ROM1:4706 CD B5 27         call 27B5
ROM1:4709 AF               xor  a
ROM1:470A 22               ldi  (hl),a
ROM1:470B 1B               dec  de
ROM1:470C 7B               ld   a,e
ROM1:470D B2               or   d
ROM1:470E 20 F6            jr   nz,4706
ROM1:4710 C9               ret  
ROM0:27B5 E5               push hl
ROM0:27B6 21 00 00         ld   hl,0000
ROM0:27B9 36 0A            ld   (hl),0A
ROM0:27BB E1               pop  hl
ROM0:27BC C9               ret  
ROM1:460F 11 00 00         ld   de,0000
ROM1:4612 CD DD 46         call 46DD
ROM1:4615 11 85 03         ld   de,0385
ROM1:4618 CD DD 46         call 46DD
ROM1:461B 11 0A 07         ld   de,070A
ROM1:461E CD DD 46         call 46DD
ROM1:4621 FA 03 00         ld   a,(0003)
ROM1:4624 A7               and  a
ROM1:4625 CA DC 46         jp   z,46DC
ROM1:4628 1E 00            ld   e,00
ROM1:462A 16 00            ld   d,00
ROM1:462C 01 05 A4         ld   bc,A405
ROM1:462F 21 CC 45         ld   hl,45CC
ROM1:4632 19               add  hl,de
ROM1:4633 2A               ldi  a,(hl)
ROM1:4634 02               ld   (bc),a
ROM1:4635 03               inc  bc
ROM1:4636 1C               inc  e
ROM1:4637 7B               ld   a,e
ROM1:4638 FE 43            cp   a,43
ROM1:463A 20 F3            jr   nz,462F
ROM1:463C 3E 01            ld   a,01
ROM1:463E EA 53 A4         ld   (A453),a
ROM1:4641 3E 01            ld   a,01
ROM1:4643 EA 49 A4         ld   (A449),a
ROM1:4646 3E 02            ld   a,02
ROM1:4648 EA 48 A4         ld   (A448),a
ROM1:464B 21 6A A4         ld   hl,A46A
ROM1:464E 1E 09            ld   e,09
ROM1:4650 3E 02            ld   a,02
ROM1:4652 22               ldi  (hl),a
ROM1:4653 1D               dec  e
ROM1:4654 20 FC            jr   nz,4652
ROM1:4656 3E 60            ld   a,60
ROM1:4658 EA 52 A4         ld   (A452),a
ROM1:465B EA 7D A4         ld   (A47D),a
ROM1:465E EA 7C A4         ld   (A47C),a
ROM1:4661 EA 4A A4         ld   (A44A),a
ROM1:4664 3E 40            ld   a,40
ROM1:4666 EA 7B A4         ld   (A47B),a
ROM1:4669 EA 51 A4         ld   (A451),a
ROM1:466C 3E 89            ld   a,89
ROM1:466E EA 4C A4         ld   (A44C),a
ROM1:4671 3E 00            ld   a,00
ROM1:4673 EA 14 A4         ld   (A414),a
ROM1:4676 3E 07            ld   a,07
ROM1:4678 EA 4E A4         ld   (A44E),a
ROM1:467B 3E 05            ld   a,05
ROM1:467D EA 62 A4         ld   (A462),a
ROM1:4680 3E 09            ld   a,09
ROM1:4682 EA 63 A4         ld   (A463),a
ROM1:4685 3E 01            ld   a,01
ROM1:4687 EA 4D A4         ld   (A44D),a
ROM1:468A 3E 50            ld   a,50
ROM1:468C EA 5F A4         ld   (A45F),a
ROM1:468F 3E 0A            ld   a,0A
ROM1:4691 EA 60 A4         ld   (A460),a
ROM1:4694 3E 5B            ld   a,5B
ROM1:4696 EA 54 A4         ld   (A454),a
ROM1:4699 3E 46            ld   a,46
ROM1:469B EA 55 A4         ld   (A455),a
ROM1:469E 3E 4D            ld   a,4D
ROM1:46A0 EA 56 A4         ld   (A456),a
ROM1:46A3 3E 45            ld   a,45
ROM1:46A5 EA 57 A4         ld   (A457),a
ROM1:46A8 3E 42            ld   a,42
ROM1:46AA EA 58 A4         ld   (A458),a
ROM1:46AD 3E 00            ld   a,00
ROM1:46AF EA 5C A4         ld   (A45C),a
ROM1:46B2 EA 5D A4         ld   (A45D),a
ROM1:46B5 3E 00            ld   a,00
ROM1:46B7 EA 5B A4         ld   (A45B),a
ROM1:46BA EA 64 A4         ld   (A464),a
ROM1:46BD 3E 00            ld   a,00
ROM1:46BF EA 65 A4         ld   (A465),a
ROM1:46C2 3E 92            ld   a,92
ROM1:46C4 EA 66 A4         ld   (A466),a
ROM1:46C7 3E 48            ld   a,48
ROM1:46C9 EA 67 A4         ld   (A467),a
ROM1:46CC 3E 62            ld   a,62
ROM1:46CE EA 68 A4         ld   (A468),a
ROM1:46D1 21 05 A1         ld   hl,A105
ROM1:46D4 3E 80            ld   a,80
ROM1:46D6 1E 00            ld   e,00
ROM1:46D8 22               ldi  (hl),a
ROM1:46D9 1D               dec  e
ROM1:46DA 20 FC            jr   nz,46D8
ROM1:46DC C9               ret  
RO1F:4000 C3 09 40         jp   4009
RO1F:4003 C3 17 7B         jp   7B17
RO1F:4006 C3 1E 40         jp   401E
RO1F:4009 21 00 D3         ld   hl,D300
RO1F:400C 36 00            ld   (hl),00
RO1F:400E 2C               inc  l
RO1F:400F 20 FB            jr   nz,400C
RO1F:4011 3E 80            ld   a,80
RO1F:4013 E0 26            ld   (ff00+26),a
RO1F:4015 3E 77            ld   a,77
RO1F:4017 E0 24            ld   (ff00+24),a
RO1F:4019 3E FF            ld   a,FF
RO1F:401B E0 25            ld   (ff00+25),a
RO1F:401D C9               ret  
ROM0:0525 F5               push af
ROM0:0526 C5               push bc
ROM0:0527 D5               push de
ROM0:0528 E5               push hl
ROM0:0529 F3               di   
ROM0:052A F0 FD            ld   a,(ff00+FD)
ROM0:052C A7               and  a
ROM0:052D C2 B6 05         jp   nz,05B6
ROM0:0530 FA 9F C1         ld   a,(C19F)
ROM0:0533 E6 7F            and  a,7F
ROM0:0535 28 2F            jr   z,0566
ROM0:0537 FE 01            cp   a,01
ROM0:0539 28 2B            jr   z,0566
ROM0:053B FE 05            cp   a,05
ROM0:053D 30 09            jr   nc,0548
ROM0:053F CD DF 21         call 21DF
ROM0:0542 21 9F C1         ld   hl,C19F
ROM0:0545 34               inc  (hl)
ROM0:0546 18 6E            jr   05B6
ROM0:0548 FE 0A            cp   a,0A
ROM0:054A 20 05            jr   nz,0551
ROM0:054C CD A5 25         call 25A5
ROM0:054F 18 65            jr   05B6
ROM0:0551 FE 0B            cp   a,0B
ROM0:0553 20 11            jr   nz,0566
ROM0:0555 FA 72 C1         ld   a,(C172)
ROM0:0558 A7               and  a
ROM0:0559 28 06            jr   z,0561
ROM0:055B 3D               dec  a
ROM0:055C EA 72 C1         ld   (C172),a
ROM0:055F 18 05            jr   0566
ROM0:0561 CD F9 25         call 25F9
ROM0:0564 18 50            jr   05B6
ROM0:0566 FA FE D6         ld   a,(D6FE)
ROM0:0569 A7               and  a
ROM0:056A 20 4A            jr   nz,05B6
ROM0:056C F0 90            ld   a,(ff00+90)
ROM0:056E E0 E8            ld   (ff00+E8),a
ROM0:0570 21 91 FF         ld   hl,FF91
ROM0:0573 B6               or   (hl)
ROM0:0574 21 0E C1         ld   hl,C10E
ROM0:0577 B6               or   (hl)
ROM0:0578 28 11            jr   z,058B
ROM0:057A CD C0 05         call 05C0
ROM0:057D F0 E8            ld   a,(ff00+E8)
ROM0:057F FE 08            cp   a,08
ROM0:0581 30 03            jr   nc,0586
ROM0:0583 CD CC 1C         call 1CCC
ROM0:0586 CD C0 FF         call FFC0
ROM0:0589 18 2B            jr   05B6
ROM0:058B F0 BB            ld   a,(ff00+BB)
ROM0:058D A7               and  a
ROM0:058E 28 13            jr   z,05A3
ROM0:0590 3D               dec  a
ROM0:0591 E0 BB            ld   (ff00+BB),a
ROM0:0593 5F               ld   e,a
ROM0:0594 16 00            ld   d,00
ROM0:0596 21 23 05         ld   hl,0523
ROM0:0599 19               add  hl,de
ROM0:059A 7E               ld   a,(hl)
ROM0:059B EA F8 D6         ld   (D6F8),a
ROM0:059E CD EE 1D         call 1DEE
ROM0:05A1 18 E0            jr   0583
ROM0:05A3 CD A9 1A         call 1AA9
ROM0:05A6 11 01 D6         ld   de,D601
ROM0:05A9 CD D8 28         call 28D8
ROM0:05AC AF               xor  a
ROM0:05AD EA 00 D6         ld   (D600),a
ROM0:05B0 EA 01 D6         ld   (D601),a
ROM0:05B3 CD C0 FF         call FFC0
ROM0:05B6 FB               ei   
ROM0:05B7 E1               pop  hl
ROM0:05B8 D1               pop  de
ROM0:05B9 C1               pop  bc
ROM0:05BA 3E 01            ld   a,01
ROM0:05BC E0 D1            ld   (ff00+D1),a
ROM0:05BE F1               pop  af
ROM0:05BF D9               reti 
ROM0:03BD 3E 1F            ld   a,1F
ROM0:03BF EA 00 21         ld   (2100),a
ROM0:03C2 CD 80 7F         call 7F80
ROM0:03C5 3E 0C            ld   a,0C
ROM0:03C7 EA 00 21         ld   (2100),a
ROM0:03CA AF               xor  a
ROM0:03CB E0 FD            ld   (ff00+FD),a
ROM0:03CD 76               halt 
ROM0:0209 FA FD D6         ld   a,(D6FD)
ROM0:020C E6 7F            and  a,7F
ROM0:020E 5F               ld   e,a
ROM0:020F F0 40            ld   a,(ff00+40)
ROM0:0211 E6 80            and  a,80
ROM0:0213 B3               or   e
ROM0:0214 E0 40            ld   (ff00+40),a
ROM0:0216 21 E7 FF         ld   hl,FFE7
ROM0:0219 34               inc  (hl)
ROM0:021A FA 95 DB         ld   a,(DB95)
ROM0:021D FE 00            cp   a,00
ROM0:021F 20 0F            jr   nz,0230
ROM0:0221 FA 96 DB         ld   a,(DB96)
ROM0:0224 FE 08            cp   a,08
ROM0:0226 38 08            jr   c,0230
ROM0:0228 3E 01            ld   a,01
ROM0:022A EA 00 21         ld   (2100),a
ROM0:022D CD B7 6D         call 6DB7
ROM0:0230 FA 7F C1         ld   a,(C17F)
ROM0:0233 A7               and  a
ROM0:0234 CA 52 03         jp   z,0352
ROM0:0237 3C               inc  a
ROM0:0238 20 0B            jr   nz,0245
ROM0:023A 3E 17            ld   a,17
ROM0:023C EA 00 21         ld   (2100),a
ROM0:023F CD A6 46         call 46A6
ROM0:0242 C3 52 03         jp   0352
ROM0:0245 3C               inc  a
ROM0:0246 28 F2            jr   z,023A
ROM0:0248 3E 14            ld   a,14
ROM0:024A EA 00 21         ld   (2100),a
ROM0:024D FA 80 C1         ld   a,(C180)
ROM0:0250 3C               inc  a
ROM0:0251 EA 80 C1         ld   (C180),a
ROM0:0254 FE C0            cp   a,C0
ROM0:0256 20 14            jr   nz,026C
ROM0:0258 FA 7F C1         ld   a,(C17F)
ROM0:025B FE 02            cp   a,02
ROM0:025D 20 03            jr   nz,0262
ROM0:025F CD 1B 54         call 541B
ROM0:0262 AF               xor  a
ROM0:0263 EA 7F C1         ld   (C17F),a
ROM0:0266 EA CA C3         ld   (C3CA),a
ROM0:0269 C3 52 03         jp   0352
ROM0:026C FE 60            cp   a,60
ROM0:026E 38 4C            jr   c,02BC
ROM0:0270 F5               push af
ROM0:0271 E6 07            and  a,07
ROM0:0273 20 0B            jr   nz,0280
ROM0:0275 FA CA C3         ld   a,(C3CA)
ROM0:0278 FE 0C            cp   a,0C
ROM0:027A 28 3F            jr   z,02BB
ROM0:027C 3C               inc  a
ROM0:027D EA CA C3         ld   (C3CA),a
ROM0:0280 FA CA C3         ld   a,(C3CA)
ROM0:0283 5F               ld   e,a
ROM0:0284 F0 E7            ld   a,(ff00+E7)
ROM0:0286 E6 03            and  a,03
ROM0:0288 83               add  e
ROM0:0289 5F               ld   e,a
ROM0:028A 16 00            ld   d,00
ROM0:028C FA 7F C1         ld   a,(C17F)
ROM0:028F FE 03            cp   a,03
ROM0:0291 28 15            jr   z,02A8
ROM0:0293 21 6A 54         ld   hl,546A
ROM0:0296 19               add  hl,de
ROM0:0297 7E               ld   a,(hl)
ROM0:0298 EA 97 DB         ld   (DB97),a
ROM0:029B EA 99 DB         ld   (DB99),a
ROM0:029E 21 7A 54         ld   hl,547A
ROM0:02A1 19               add  hl,de
ROM0:02A2 7E               ld   a,(hl)
ROM0:02A3 EA 98 DB         ld   (DB98),a
ROM0:02A6 18 13            jr   02BB
RO1F:4204 21 60 D3         ld   hl,D360
RO1F:4207 7E               ld   a,(hl)
RO1F:4208 A7               and  a
RO1F:4209 28 11            jr   z,421C
RO1F:420B FE 01            cp   a,01
RO1F:420D 28 07            jr   z,4216
RO1F:420F FA C6 D3         ld   a,(D3C6)
RO1F:4212 A7               and  a
RO1F:4213 C2 E6 53         jp   nz,53E6
RO1F:4216 7E               ld   a,(hl)
RO1F:4217 21 00 41         ld   hl,4100
RO1F:421A 18 07            jr   4223
RO1F:421C 23               inc  hl
RO1F:421D 7E               ld   a,(hl)
RO1F:421E A7               and  a
RO1F:421F C8               ret  z
RO1F:4220 21 82 41         ld   hl,4182
RO1F:4223 CD 60 7A         call 7A60
RO1F:4226 11 90 D3         ld   de,D390
RO1F:4229 01 94 D3         ld   bc,D394
RO1F:422C E9               jp   hl
ROM0:27FE FA 24 C1         ld   a,(C124)
ROM0:2801 A7               and  a
ROM0:2802 20 34            jr   nz,2838
ROM0:2804 3E 20            ld   a,20
ROM0:2806 E0 00            ld   (ff00+00),a
ROM0:2808 F0 00            ld   a,(ff00+00)
ROM0:280A F0 00            ld   a,(ff00+00)
ROM0:280C 2F               cpl  
ROM0:280D E6 0F            and  a,0F
ROM0:280F 47               ld   b,a
ROM0:2810 3E 10            ld   a,10
ROM0:2812 E0 00            ld   (ff00+00),a
ROM0:2814 F0 00            ld   a,(ff00+00)
ROM0:2816 F0 00            ld   a,(ff00+00)
ROM0:2818 F0 00            ld   a,(ff00+00)
ROM0:281A F0 00            ld   a,(ff00+00)
ROM0:281C F0 00            ld   a,(ff00+00)
ROM0:281E F0 00            ld   a,(ff00+00)
ROM0:2820 F0 00            ld   a,(ff00+00)
ROM0:2822 F0 00            ld   a,(ff00+00)
ROM0:2824 CB 37            swap a
ROM0:2826 2F               cpl  
ROM0:2827 E6 F0            and  a,F0
ROM0:2829 B0               or   b
ROM0:282A 4F               ld   c,a
ROM0:282B F0 CB            ld   a,(ff00+CB)
ROM0:282D A9               xor  c
ROM0:282E A1               and  c
ROM0:282F E0 CC            ld   (ff00+CC),a
ROM0:2831 79               ld   a,c
ROM0:2832 E0 CB            ld   (ff00+CB),a
ROM0:2834 3E 30            ld   a,30
ROM0:2836 E0 00            ld   (ff00+00),a
