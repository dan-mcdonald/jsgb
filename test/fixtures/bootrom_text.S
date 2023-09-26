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