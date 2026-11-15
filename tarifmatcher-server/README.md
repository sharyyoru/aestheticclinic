# TarifMatcher server

HTTP wrapper around the official OAAT TarifMatcher — the ambulatory flat-rate
grouper that turns gesture codes + an ICD-10 diagnosis into a flat rate
(`C09.AC.0140` + `N64.8` → `C09.18B`, cost weight `4525.22`).

It exists as a separate service because the grouper is a **Java library** and
Vercel's Node runtime has no JVM. Same arrangement as `whatsapp-server/`, and
the same reason the old Sumex1 validator lived on its own box.

## Endpoints

```
GET  /health  -> { ok, applicationYear, missing: [] }
POST /group   -> { services: ["C09.AC.0140"], diagnoses: ["N64.8"],
                   ageYears?: 45, caseId?: "inv1009515" }
                 { ok, applicationYear, results: [
                     { caseId, flatRate, costWeight, mappedTardocs }
                   ], warnings: [] }
```

## Deploying to Railway

1. New service → deploy from this repo → root directory `tarifmatcher-server`.
   It builds from the `Dockerfile` (Temurin JRE 21 + Node).
2. Set `TARIFMATCHER_SECRET` to a random string.
3. Copy the public URL.
4. In Vercel, set on the main app:
   - `TARIFMATCHER_URL` = the Railway URL
   - `TARIFMATCHER_SECRET` = the same secret
   …and redeploy. A Vercel env var only takes effect on the next deployment.

Until `TARIFMATCHER_URL` is set the app keeps its previous behaviour and
refuses to group, rather than guessing a flat rate.

## Tariff year — read before widening this

Everything in `tariffs/` is `application_year: 2027` and applies from
1 January 2027. `/api/acf/sumex` therefore refuses to group a treatment dated
before then: pricing a 2026 treatment with the 2027 system produces the wrong
flat rate, which is worse than not grouping at all.

The CHF 53k of *"le code tarifaire ne correspond pas au résultat du grouper
ambulatoire"* rejections are 2026 invoices, so **this does not fix them**.
That needs the 2026 grouper trees (ambP v11 / v1.1c) from OAAT-OTMA; drop them
in `tariffs/` and select by service date in `src/lib/tarifmatcher.ts`.

## Notes on the vendor jar

`tarifmatcher-1.2.1-standalone.jar` ships with a broken manifest:
`Main-Class` is declared as `ch.oaat_otma.grouper.batchgrouper.Batchgrouper.java`
— with the `.java` suffix — so `java -jar` fails with `ClassNotFoundException`.
It must be invoked on the classpath instead, which is what `server.js` does.

The wrapper shells out to the batch grouper rather than binding the Java API,
so the grouping semantics stay the vendor's. Reimplementing them would mean
owning 483 decision-tree expressions across 1,008 nodes and keeping them
correct — on billing output.

Local check:

```bash
node server.js            # PORT=8080 by default
curl -s localhost:8080/health
curl -s -X POST localhost:8080/group -H 'Content-Type: application/json' \
  -d '{"services":["C09.AC.0140"],"diagnoses":["N64.8"],"ageYears":45}'
```
