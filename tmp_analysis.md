# Fleet Data Analysis

## Rently shows:
- 911-2 5056NLW
- 911-1 7850NFJ
- CAYENNE-1 4005NLH
- CAYENNE-2 4494NKF
- G580-1 1921MWW
- G580-2 4019NBT
- PORTO-1 PORTO-1
- HURACAN-1 HURACAN-1

## PlanMint shows for Porsche:
- 992 Carrera Cabrio (listos: 0, pend: 2, uso: 0)  → this is 2 units = 911-1 + 911-2
- Porsche Carrera (listos: 0, pend: 0, uso: 0)  → this is 1 extra unit? cat: 5
- Cayenne (listos: 0, pend: 0, uso: 0) → only 1 unit? But Rently shows 2

## Issues:
1. "Porsche Carrera" with cat "5" seems like a bad/duplicate entry
2. Cayenne shows only 1 unit but Rently has 2 (CAYENNE-1 + CAYENNE-2)
3. V Class and VITO are separate models - need to check if VTO = VITO

## V Class issue:
- V Class 300D Extralang (listos: 1, pend: 1, uso: 0) - this is the 8 pax
- VITO (listos: 0, pend: 4, uso: 0) - this is the VTO/9 pax

The user wants V and VTO separated. Currently they ARE separate models (V Class vs VITO).
The grouping logic might be merging them into "Mercedes Clase V" family.

## Clase B issue:
B models: B 180 D, B 180 D DCT 116 5P, B 200 D, B 200 D DCT 150 5P, B 200 MHEV 163 CV, B 250 E PHEV 218 5P, Clase B
"Clase B" is a separate entry with (listos: 0, pend: 1, uso: 0) - this might be the extra one
