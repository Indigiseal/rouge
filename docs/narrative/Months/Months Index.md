---
type: index
project: Evershift
status: canon-draft
tags:
  - evershift
  - months
  - database
---

# Months Index

> [!info]
> All months below are **examples**. They can be renamed, merged, or replaced without breaking the Second Moon / Waystar canon.

## Database (Dataview)

```dataview
TABLE month_number AS "#", theme AS Theme, threat AS Threat, mood AS Mood, status AS Status
FROM "Narrative/Months"
WHERE type = "month"
SORT month_number ASC
```

## List

1. [[01 Thornwake|Thornwake]] — forest and thorns
2. [[02 Silkdeep|Silkdeep]] — caves and silk
3. [[03 Tollroad|Tollroad]] — roads and tolls
4. [[04 Boneflood|Boneflood]] — bones and crypts
5. [[05 Mireturn|Mireturn]] — bogs and rot
6. [[06 Veilbleed|Veilbleed]] — souls and veil
7. [[07 Ashhowl|Ashhowl]] — hounds and ash
8. [[08 Brassfair|Brassfair]] — carnival and deals
9. [[09 Frosthollow|Frosthollow]] — cold and hunger
10. [[10 Stormhatch|Stormhatch]] — storm and hatching
11. [[11 Mirrorwane|Mirrorwane]] — mirrors and doubles
12. [[12 Spherefall|Spherefall]] — nearness of the sphere

## Template for a new month

Every month card should include:

- `month_number`, `name`, `theme`, `threat`, `mood`, `enemies`
- a short atmospheric paragraph
- an essence table
- a draft opening text
- related links
