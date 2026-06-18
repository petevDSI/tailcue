export type Category =
  | 'wellness'
  | 'diagnostics'
  | 'surgical_routine'
  | 'surgical_common'
  | 'emergency'
  | 'skin_ear_eye'

export type Species = 'dog' | 'cat' | 'both'

export type VetQuestion = {
  question: string
  listen_for: string
  why_it_matters: string
}

export type Procedure = {
  id: string
  slug: string
  display_name: string
  clinical_name: string | null
  category: Category
  species: Species
  description_plain: string
  questions_to_ask: VetQuestion[]
  sort_order: number
  is_active: boolean
}

export type Metro = {
  metro_code: string
  display_name: string
  zip_prefixes: string[]
  cost_multiplier: number
  tier: 1 | 2 | 3
}

export type PriceBenchmark = {
  p50: number
  p70: number
  p90: number
}

export type NationalBenchmarks = Record<
  string,
  { dog?: PriceBenchmark; cat?: PriceBenchmark }
>

// ---------------------------------------------------------------------------
// PROCEDURES
// ---------------------------------------------------------------------------

export const PROCEDURES: Procedure[] = [
  // WELLNESS / PREVENTIVE
  {
    id: '1',
    slug: 'annual-wellness-exam',
    display_name: 'Annual Wellness Exam',
    clinical_name: 'Comprehensive Physical Examination',
    category: 'wellness',
    species: 'both',
    description_plain:
      'A head-to-tail physical checkup performed once a year to catch health problems before they become serious. Your vet checks eyes, ears, teeth, heart, lungs, abdomen, skin, and joints. Early detection through annual exams is the single best way to keep long-term vet costs down.',
    questions_to_ask: [
      {
        question: "What's included in the exam fee — does it cover any vaccines or tests?",
        listen_for: 'A clear itemized answer. Watch out if vaccines, lab tests, or parasite screens are bundled in without separate pricing — you can\'t comparison-shop what you can\'t see broken out.',
        why_it_matters: 'Exam prices vary from $50–$100+, and add-ons can quietly triple the bill. Knowing what\'s included lets you decide what to accept at the visit versus defer.',
      },
      {
        question: 'Will you do a dental check and flag any issues?',
        listen_for: 'They should describe a full oral exam — checking teeth, gums, and noting any buildup or abnormalities. A vague "yes" without specifics is a yellow flag.',
        why_it_matters: 'Dental disease is the most under-diagnosed condition in pets. Finding it early at a wellness exam can prevent a $600–$1,800 dental cleaning plus extractions later.',
      },
      {
        question: "What screening tests do you recommend for my pet's age and breed?",
        listen_for: 'Age-appropriate recommendations — heartworm test, fecal, bloodwork for seniors. Be cautious if the vet recommends a large battery of tests for a young, healthy pet with no symptoms.',
        why_it_matters: 'Preventive screening saves money long-term when done strategically. Unnecessary testing adds cost without clinical benefit.',
      },
      {
        question: 'Is this price the same if I add vaccines today?',
        listen_for: 'A straight yes or each vaccine priced separately. A bundle price with no ability to opt out of individual vaccines is a red flag.',
        why_it_matters: 'Vaccine prices vary widely — $15–$40 per vaccine at full-service practices, vs. $10–$15 at low-cost clinics. Knowing upfront lets you decide whether to do them here or elsewhere.',
      },
    ],
    sort_order: 1,
    is_active: true,
  },
  {
    id: '2',
    slug: 'core-vaccine-dog',
    display_name: 'Core Vaccine Package — Dog',
    clinical_name: 'DHPP + Rabies + Bordetella',
    category: 'wellness',
    species: 'dog',
    description_plain:
      'The standard set of vaccines every dog needs to stay protected against serious and potentially fatal diseases. DHPP covers Distemper, Hepatitis, Parvovirus, and Parainfluenza; Rabies is legally required in most states; Bordetella prevents kennel cough. These are typically given together at the annual visit and may require boosters on a 1- or 3-year schedule.',
    questions_to_ask: [
      {
        question: 'Is this a 1-year or 3-year Rabies vaccine?',
        listen_for: 'A direct answer. Most adult dogs who have had at least one prior Rabies vaccine are eligible for the 3-year version, which costs about the same but requires boosters less often.',
        why_it_matters: 'A 1-year Rabies vaccine means you\'ll pay again next year. If your dog qualifies for the 3-year, there\'s no medical reason to use the 1-year.',
      },
      {
        question: 'Is Bordetella included or billed separately?',
        listen_for: "Whether it's oral, intranasal, or injectable — and if it's already in the quote. Some practices bundle it; others bill it as an add-on.",
        why_it_matters: 'Bordetella (kennel cough) vaccine costs $15–$30 and is required by most boarding facilities and groomers. If it\'s not in the quote, it\'ll be added when you arrive.',
      },
      {
        question: 'Does the price include the exam fee or just the vaccines?',
        listen_for: 'An explicit yes or no, not a vague "it depends." Many clinics charge the exam fee separately even at vaccine-only appointments.',
        why_it_matters: 'The exam fee ($50–$100) can cost more than the vaccines themselves. If you just got an exam at a recent visit, ask if it can be waived.',
      },
      {
        question: "Is Leptospirosis or Lyme vaccine recommended for my dog's lifestyle?",
        listen_for: 'A lifestyle-based recommendation, not a blanket yes. Lepto is recommended for dogs with water/wildlife exposure; Lyme for tick-endemic areas.',
        why_it_matters: 'These non-core vaccines add $20–$35 each and require annual boosters. They\'re worth it in the right situations — but not for every urban apartment dog.',
      },
      {
        question: 'Which vaccines are due this visit vs. next year?',
        listen_for: 'A specific schedule showing which are boosters now and which aren\'t due. DHPP is typically every 3 years after initial series; Rabies schedule depends on prior history.',
        why_it_matters: 'Over-vaccinating is a real issue. AAHA guidelines recommend triennial core vaccines in most adult dogs. Knowing what\'s actually due prevents paying for vaccines not yet needed.',
      },
    ],
    sort_order: 2,
    is_active: true,
  },
  {
    id: '3',
    slug: 'core-vaccine-cat',
    display_name: 'Core Vaccine Package — Cat',
    clinical_name: 'FVRCP + Rabies',
    category: 'wellness',
    species: 'cat',
    description_plain:
      'The essential vaccine set for cats, protecting against common and serious feline diseases. FVRCP covers Feline Viral Rhinotracheitis (herpesvirus), Calicivirus, and Panleukopenia (feline distemper); Rabies is required by law in most states. Indoor cats still need these — panleukopenia is highly contagious and Rabies exposure can happen even without outdoor access.',
    questions_to_ask: [
      {
        question: 'Is this a 1-year or 3-year Rabies vaccine?',
        listen_for: 'A direct answer. For indoor cats with current rabies vaccination, the 3-year version is appropriate in most states.',
        why_it_matters: 'The 3-year vaccine is the same price but you won\'t need it again for 3 years — saves you a visit and the associated exam fee.',
      },
      {
        question: 'Does my indoor cat need all of these?',
        listen_for: 'A nuanced answer about FVRCP being recommended for all cats (even indoor) because panleukopenia is highly contagious, while FeLV and others depend on outdoor exposure.',
        why_it_matters: 'Indoor cats are lower risk for some diseases, but FVRCP is still standard. If a vet is pushing all vaccines equally for a never-outdoor cat, ask for the clinical rationale.',
      },
      {
        question: 'Is the FeLV (feline leukemia) vaccine recommended for my cat?',
        listen_for: 'An honest risk assessment — FeLV vaccine is recommended for cats with outdoor access or exposure to other cats. For fully indoor single cats, it\'s often optional.',
        why_it_matters: 'FeLV vaccine costs $20–$35 and requires annual boosting. If your cat has no exposure risk, it\'s an unnecessary recurring expense.',
      },
      {
        question: 'Is the exam fee included in this quote?',
        listen_for: 'A direct yes or no. If not included, ask if a vaccine-only appointment is available at a lower visit fee if you already had a recent exam.',
        why_it_matters: 'Exam fees can double the cost of a vaccine visit. Understanding the breakdown prevents sticker shock at checkout.',
      },
    ],
    sort_order: 3,
    is_active: true,
  },
  {
    id: '4',
    slug: 'heartworm-test',
    display_name: 'Heartworm Test',
    clinical_name: 'Canine Heartworm Antigen Test',
    category: 'wellness',
    species: 'dog',
    description_plain:
      'A simple blood test that detects proteins released by adult heartworms living in your dog\'s heart and pulmonary arteries. Heartworm disease is transmitted by mosquitoes and can be fatal if untreated — treatment costs $1,500–$3,000 versus $10–20/month for prevention. Most vets require a negative test before prescribing or refilling heartworm prevention medication.',
    questions_to_ask: [
      {
        question: 'Is this test included in the wellness exam fee, or billed separately?',
        listen_for: 'A clear billing answer. Some practices include it in the annual wellness package; others add it as a $35–$60 line item.',
        why_it_matters: 'If it\'s bundled, great. If not, knowing the price upfront prevents surprise charges — and lets you shop around if needed.',
      },
      {
        question: 'How long before results are ready?',
        listen_for: 'In-house tests give results in minutes; send-out labs take 24–48 hours. In-house is strongly preferable for this routine test.',
        why_it_matters: 'A delayed result means delayed prevention. Most dogs shouldn\'t go a single day without heartworm prevention if they live in endemic areas.',
      },
      {
        question: 'If my dog tests positive, what are the treatment options and cost range?',
        listen_for: 'An honest explanation of the multi-month treatment protocol and a realistic cost range of $1,500–$3,000.',
        why_it_matters: 'Understanding the severity of treatment makes the $10–$20/month cost of prevention obviously worthwhile — and helps you plan if a positive result occurs.',
      },
      {
        question: 'Does a positive test require additional confirmation testing?',
        listen_for: 'Yes — a positive antigen test should be confirmed with a microfilaria test and ideally a second antigen test from a reference lab before treatment begins.',
        why_it_matters: 'Confirming the diagnosis before beginning a difficult and expensive treatment is critical. False positives, while rare, do occur.',
      },
    ],
    sort_order: 4,
    is_active: true,
  },
  {
    id: '5',
    slug: 'fecal-parasite-test',
    display_name: 'Fecal Parasite Test',
    clinical_name: 'Fecal Flotation / Ova & Parasite',
    category: 'wellness',
    species: 'both',
    description_plain:
      'A microscopic examination of your pet\'s stool to detect intestinal parasites like roundworms, hookworms, whipworms, giardia, and coccidia. Many parasites shed eggs intermittently, so a single negative test doesn\'t guarantee a parasite-free pet. The AVMA recommends testing at least once a year, and more often for puppies, kittens, and outdoor pets.',
    questions_to_ask: [
      {
        question: 'Does this test screen for giardia, or is that a separate add-on?',
        listen_for: 'Standard fecal flotation often misses giardia, which requires a separate SNAP ELISA or PCR test. The answer should be specific.',
        why_it_matters: 'Giardia is common and contagious to humans. If it\'s not included, it may be worth adding — especially for pets with diarrhea or water exposure.',
      },
      {
        question: 'How fresh does the sample need to be, and how should I store it?',
        listen_for: 'Ideally less than 6 hours old at room temperature, or up to 24 hours refrigerated. Improper storage kills eggs and produces false negatives.',
        why_it_matters: 'A bad sample = an inaccurate result. Getting specific instructions prevents a wasted trip and retesting fees.',
      },
      {
        question: 'If parasites are found, is treatment included in this price?',
        listen_for: 'Almost certainly not — treatment is billed separately. A good vet will say so clearly and give you a sense of what deworming costs.',
        why_it_matters: 'Sets financial expectations. Most dewormers are inexpensive ($10–$40), but knowing in advance avoids sticker shock.',
      },
      {
        question: 'How long do results take?',
        listen_for: 'In-house fecals take a few minutes to an hour; send-out labs take 1–3 days. For a symptomatic pet, ask for the in-house option.',
        why_it_matters: 'If your pet has active diarrhea, a 3-day wait for results delays treatment and potential transmission to other household pets.',
      },
    ],
    sort_order: 5,
    is_active: true,
  },
  {
    id: '6',
    slug: 'flea-tick-prevention-6mo',
    display_name: 'Flea & Tick Prevention — 6 Month Supply',
    clinical_name: null,
    category: 'wellness',
    species: 'both',
    description_plain:
      'A 6-month supply of prescription flea and tick preventatives, the most effective and safest options available. Common products include oral chewables like NexGard, Simparica, or Bravecto, or topical treatments like Frontline or Revolution. These require a valid vet-client relationship and are often competitively priced when your vet matches manufacturer rebates.',
    questions_to_ask: [
      {
        question: 'Which product do you recommend, and does it cover ticks as well as fleas?',
        listen_for: 'A product-specific recommendation with coverage details. Many pet owners buy flea-only products and are surprised by tick infestation — and tick diseases are far more dangerous.',
        why_it_matters: 'Some products cover fleas only, while others cover fleas, ticks, and heartworm. Getting the wrong product wastes money and leaves your pet unprotected.',
      },
      {
        question: 'Is this priced competitively with online pet pharmacies — can you price-match?',
        listen_for: 'Many vets will now match or come close to Chewy or 1-800-PetMeds prices, especially for 6-month supplies. A flat "no" is worth noting.',
        why_it_matters: 'Vet office prices for preventatives can be 30–50% higher than online pharmacies for identical products. You\'re entitled to ask.',
      },
      {
        question: 'Does the manufacturer offer a rebate program I can use?',
        listen_for: 'Most major brands (NexGard, Simparica, Bravecto) have rebate portals offering $10–$40 back on 6-month supplies. A knowledgeable practice will know about these.',
        why_it_matters: 'Rebates can significantly reduce your effective cost — often bringing clinic prices in line with online pharmacies.',
      },
      {
        question: 'Is a written prescription available if I buy elsewhere?',
        listen_for: 'Yes — vets are legally required to provide a written prescription on request if you have an active vet-client-patient relationship. Resistance to this is a red flag.',
        why_it_matters: 'With a written prescription, you can fill it at any licensed pharmacy. This is your legal right and can save real money.',
      },
    ],
    sort_order: 6,
    is_active: true,
  },
  {
    id: '7',
    slug: 'dental-cleaning-dog',
    display_name: 'Dental Cleaning — Adult Dog',
    clinical_name: 'Prophylaxis Under Anesthesia',
    category: 'wellness',
    species: 'dog',
    description_plain:
      'A professional dental cleaning performed under general anesthesia — the only safe and effective way to clean below the gumline where periodontal disease starts. The procedure includes scaling, polishing, and a full oral exam, and may add X-rays and extractions if disease is found. Without regular cleanings, dental disease affects over 80% of dogs by age 3 and can lead to painful infections, tooth loss, and systemic organ damage.',
    questions_to_ask: [
      {
        question: 'Are dental X-rays included in the base price, or billed separately?',
        listen_for: 'Dental X-rays should always be part of a complete dental cleaning — the AVMA and AVDC consider them the standard of care. If the vet says X-rays are optional, that\'s a concern.',
        why_it_matters: 'Up to 60% of dental disease in dogs is below the gumline and invisible without X-rays. Skipping them means missing disease — and potential surprise extractions at the next visit.',
      },
      {
        question: 'How are extractions priced — per tooth or a flat add-on range?',
        listen_for: 'Most practices charge per tooth ($25–$150 depending on complexity). Ask for a "best case / worst case" estimate, because extractions aren\'t known until your dog is under anesthesia.',
        why_it_matters: 'Extractions are the biggest cost variable in dental work. Understanding the per-tooth or tiered pricing prevents shocking final bills.',
      },
      {
        question: 'What pre-anesthetic bloodwork is required, and is it included?',
        listen_for: 'For dogs over 5–7 years, bloodwork is standard of care before anesthesia. Younger, healthy dogs may not need it, but it\'s never inappropriate to offer it.',
        why_it_matters: 'If bloodwork isn\'t included in the quote, it\'s a $100–$200 add-on. Understanding what\'s included prevents unexpected charges.',
      },
      {
        question: 'What monitoring equipment is used during anesthesia?',
        listen_for: 'At minimum: pulse oximetry, blood pressure, ECG, capnography, and body temperature. A practice that can\'t name these is cutting corners on safety.',
        why_it_matters: 'Anesthesia deaths in healthy dogs are rare but real. Proper monitoring is the difference between a routine procedure and a tragedy.',
      },
      {
        question: 'Is an IV catheter and fluids included in the price?',
        listen_for: 'IV access and fluids should be included — they\'re standard of care for any procedure under general anesthesia. If they\'re extra, expect a $50–$120 add-on.',
        why_it_matters: 'IV fluids support blood pressure during anesthesia and provide emergency access. This isn\'t optional safety equipment — it\'s the standard.',
      },
    ],
    sort_order: 7,
    is_active: true,
  },
  {
    id: '8',
    slug: 'dental-cleaning-cat',
    display_name: 'Dental Cleaning — Adult Cat',
    clinical_name: 'Prophylaxis Under Anesthesia',
    category: 'wellness',
    species: 'cat',
    description_plain:
      'A full dental cleaning under general anesthesia to remove plaque and tartar, probe for periodontal pockets, and treat gum disease. Cats are stoic and rarely show obvious dental pain — by the time they stop eating, disease is often severe. Cats also have a unique condition called tooth resorption (affecting 30–40% of adult cats) that requires X-rays to diagnose.',
    questions_to_ask: [
      {
        question: 'Are dental X-rays included? Cats need them to diagnose tooth resorption.',
        listen_for: 'Yes, and they should be offered proactively. Cat dental X-rays are even more critical than dog X-rays — tooth resorption lesions are often invisible to the naked eye.',
        why_it_matters: 'Tooth resorption affects 30–40% of adult cats and is extremely painful. Without X-rays, affected teeth go undetected — and your cat suffers in silence.',
      },
      {
        question: 'How are extractions priced if teeth need to come out?',
        listen_for: 'Per-tooth pricing or a tiered range. For cats with tooth resorption, extractions are often extensive and involve surgical sectioning of the roots.',
        why_it_matters: 'A cat dental that starts at $400 can end at $900 if multiple teeth are extracted. Getting a range in advance avoids financial surprises.',
      },
      {
        question: 'What pre-anesthetic bloodwork do you require for cats?',
        listen_for: 'Full bloodwork is standard of care for cats before anesthesia — cats are excellent at hiding kidney disease, which is the #1 cause of anesthesia complications in cats over 7.',
        why_it_matters: 'Pre-anesthetic bloodwork in cats can detect hidden kidney disease that would make anesthesia dangerous — especially important for middle-aged and senior cats.',
      },
      {
        question: 'What anesthesia monitoring is included?',
        listen_for: 'Pulse oximetry, blood pressure, ECG, capnography, temperature. Cats are higher anesthesia risk than dogs on a per-procedure basis.',
        why_it_matters: 'Cats are less forgiving of anesthesia errors than dogs. A practice with proper monitoring equipment is worth a somewhat higher price.',
      },
      {
        question: 'How is pain managed after the procedure?',
        listen_for: 'Take-home oral pain medication (buprenorphine or meloxicam) should be standard after any dental extractions. "She\'ll be fine" is not acceptable post-op pain management.',
        why_it_matters: 'Dental pain is real and significant. Proper pain management speeds recovery and prevents post-op complications from stress and inflammation.',
      },
    ],
    sort_order: 8,
    is_active: true,
  },

  // DIAGNOSTICS
  {
    id: '9',
    slug: 'blood-panel-basic',
    display_name: 'Blood Panel — Basic',
    clinical_name: 'CBC + Chemistry',
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'A complete blood count (CBC) plus a chemistry panel that gives your vet a snapshot of your pet\'s overall internal health. The CBC evaluates red and white blood cells and platelets; the chemistry panel checks organ function including kidney, liver, and blood sugar. This is the most common diagnostic test run before anesthesia or when a pet seems "off."',
    questions_to_ask: [
      {
        question: 'Is this processed in-house or sent to an outside lab, and when will results be ready?',
        listen_for: 'In-house analyzers give results in 20–30 minutes; reference labs take 24–48 hours. For a sick pet, in-house is significantly better.',
        why_it_matters: 'If your pet needs urgent treatment, a 2-day wait for bloodwork results delays diagnosis and care — and can meaningfully change the outcome.',
      },
      {
        question: 'What organ values are included in this panel?',
        listen_for: 'At minimum: BUN, creatinine, and SDMA for kidneys; ALT and ALP for liver; glucose; total protein and albumin. Ask for the specific panel list.',
        why_it_matters: 'Not all "basic" panels are created equal. Some cut-rate panels omit critical values. Knowing what\'s included lets you evaluate whether it\'s truly comprehensive.',
      },
      {
        question: 'Does this include a thyroid test, or is that extra?',
        listen_for: 'Thyroid (T4) is usually separate. For dogs over 7 or cats, it\'s worth asking if it should be added — and at what cost.',
        why_it_matters: 'Thyroid disease is among the most common senior pet conditions and is very treatable when caught early. Adding T4 to a blood draw is inexpensive compared to diagnosing it late.',
      },
      {
        question: "If values are abnormal, what's the next step and estimated cost?",
        listen_for: 'A clear framework for follow-up — repeat testing, specialist referral, imaging. An honest cost range is a sign of a proactive vet.',
        why_it_matters: 'Bloodwork is the beginning of a diagnostic conversation, not the end. Knowing what abnormal results typically lead to helps you plan financially and emotionally.',
      },
    ],
    sort_order: 9,
    is_active: true,
  },
  {
    id: '10',
    slug: 'blood-panel-senior',
    display_name: 'Blood Panel — Senior / Full',
    clinical_name: 'CBC + Chemistry + Thyroid',
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'An expanded blood panel that adds thyroid function (T4) to the standard CBC and chemistry, providing a more complete picture for pets over 7 years old. Hypothyroidism is extremely common in older dogs, and hyperthyroidism is the most common hormonal disorder in cats over 10. Catching these early makes them much easier and less expensive to manage long-term.',
    questions_to_ask: [
      {
        question: 'What specific thyroid test is included — free T4 or total T4?',
        listen_for: 'Total T4 is the standard screening test. Free T4 (by equilibrium dialysis) is more sensitive but more expensive, reserved for borderline results. A good vet knows the difference.',
        why_it_matters: 'Thyroid testing for senior dogs and cats is one of the highest-yield screenings available. Confirming what you\'re getting ensures you can interpret results accurately.',
      },
      {
        question: 'Does this panel include electrolytes and phosphorus?',
        listen_for: 'Sodium, potassium, chloride, and phosphorus should be in a comprehensive senior panel. Phosphorus is especially critical for assessing kidney disease progression in cats.',
        why_it_matters: 'Electrolyte imbalances and elevated phosphorus are early indicators of serious disease. Missing them in a "senior panel" is a meaningful gap.',
      },
      {
        question: 'How does this differ from your standard senior wellness bloodwork package?',
        listen_for: 'A clear comparison of what\'s added vs. the basic panel. The senior package should include thyroid and ideally SDMA (an early kidney biomarker) at minimum.',
        why_it_matters: 'The price premium for a senior panel is usually $30–$60 over a basic panel. Understanding what you\'re getting for that premium confirms it\'s worth it.',
      },
      {
        question: 'If thyroid is abnormal, what does follow-up testing typically cost?',
        listen_for: 'For cats: hyperthyroid management options (medication, radioactive iodine, surgery) and relative costs. For dogs: hypothyroid follow-up bloodwork and medication costs.',
        why_it_matters: 'Thyroid disease is manageable but chronic. Knowing the treatment path and ongoing costs helps you make informed decisions at diagnosis rather than in crisis.',
      },
    ],
    sort_order: 10,
    is_active: true,
  },
  {
    id: '11',
    slug: 'urinalysis',
    display_name: 'Urinalysis',
    clinical_name: null,
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'A urine test that evaluates kidney function, detects urinary tract infections, and screens for diabetes, bladder crystals, and other conditions. It\'s often recommended alongside bloodwork for a complete health picture, especially in senior pets and cats who are prone to kidney disease and bladder issues. Price can vary significantly based on whether it\'s a basic dipstick test or a full sediment examination.',
    questions_to_ask: [
      {
        question: 'Does this include a full sediment exam or just a dipstick test?',
        listen_for: 'A dipstick is a quick screen; sediment exam adds microscopic analysis of cells, casts, and crystals — far more valuable. A complete urinalysis should include both.',
        why_it_matters: 'A dipstick alone misses bladder infections, crystals, and casts. You should always be getting the full sediment exam — not just the quick screen.',
      },
      {
        question: 'Does it include a urine culture if infection is suspected, or is that billed separately?',
        listen_for: 'Culture is almost always separate ($60–$120). A practice that automatically adds culture when the sediment suggests infection is being thorough.',
        why_it_matters: 'Treating a UTI empirically without culture often fails or selects for resistant bacteria. A culture tells you exactly which antibiotic will work.',
      },
      {
        question: 'How should I collect the sample — do you provide a kit?',
        listen_for: 'Midstream free-catch is best for dogs; cystocentesis (needle aspirate, done in-office) is the gold standard for cats and any case where sterile results matter.',
        why_it_matters: 'A contaminated sample means inaccurate results. Free-catch urine can show false-positive bacteria. Knowing the right collection method prevents repeat testing.',
      },
      {
        question: 'Is this run in-house or sent to a lab?',
        listen_for: 'In-house urinalysis gives results in minutes and is appropriate for most situations. Send-out gives more detailed results but takes days.',
        why_it_matters: 'For a sick or symptomatic pet, in-house results allow same-day treatment decisions. For a routine screen, send-out is fine.',
      },
    ],
    sort_order: 11,
    is_active: true,
  },
  {
    id: '12',
    slug: 'xray-single',
    display_name: 'X-Ray — Single View',
    clinical_name: 'Radiograph — Single View',
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'A single digital X-ray image used to evaluate bones, joints, chest, or abdomen for injury, disease, or foreign objects. Digital X-rays are now standard at most practices and provide better image quality than film with less radiation. A single view is often sufficient for straightforward cases like a suspected fracture or quick foreign object check.',
    questions_to_ask: [
      {
        question: 'Is sedation required, and if so, is it included in the price?',
        listen_for: 'Many X-rays can be done without sedation on cooperative pets. When sedation is recommended, ask what it adds to the total cost.',
        why_it_matters: 'Sedation adds $50–$150 to any procedure. Knowing upfront prevents sticker shock.',
      },
      {
        question: 'Will images be reviewed by an on-site radiologist or your staff?',
        listen_for: 'Most general practices read their own radiographs. For complex findings, a teleradiology service can provide a specialist read — usually for an additional $50–$150.',
        why_it_matters: 'Missed findings on X-rays can delay critical diagnoses. For complex cases, a specialist read is worth the cost.',
      },
      {
        question: 'Can I get a copy of the image for a second opinion?',
        listen_for: 'Digital X-rays should be easily sharable as DICOM files or high-resolution images. Any resistance to sharing your pet\'s records is a red flag.',
        why_it_matters: 'You own your pet\'s records and have the right to a copy. Having the images allows specialist review without re-imaging — saving money and reducing radiation exposure.',
      },
      {
        question: 'If more views are needed, how is additional pricing handled?',
        listen_for: 'Per-view pricing vs. a package/series rate. Know in advance what each additional view costs so you can make informed decisions.',
        why_it_matters: 'What starts as a single view often becomes 2–3 for a complete diagnostic picture. Understanding the per-view pricing prevents unexpected bills.',
      },
    ],
    sort_order: 12,
    is_active: true,
  },
  {
    id: '13',
    slug: 'xray-series',
    display_name: 'X-Ray — Series',
    clinical_name: 'Radiograph — 2–3 Views',
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'Two to three X-ray views taken from different angles to get a complete picture of a body area or condition. Multiple views are the standard of care for chest and abdominal evaluations, orthopedic issues, and most diagnostic imaging workups. Vets often recommend a series rather than a single view when they suspect something systemic or need to rule out multiple conditions.',
    questions_to_ask: [
      {
        question: 'How many views are included in this price?',
        listen_for: 'Should be 2–3 views. Standard chest X-rays should be at least 2 views (lateral + VD/DV); abdominal should be 2 views minimum.',
        why_it_matters: 'More views = more diagnostic information. Knowing the count in the quote prevents you from paying a series price for a single view.',
      },
      {
        question: "Is sedation included if my pet won't hold still?",
        listen_for: 'For routine series, sedation is often not needed. If recommended, the reason should make clinical sense — positioning accuracy, not just convenience.',
        why_it_matters: 'Sedation adds cost and risk. Understanding when it\'s clinically necessary helps you decide.',
      },
      {
        question: 'Will a radiologist specialist read these, or your staff?',
        listen_for: 'For suspected cardiac disease, cancer staging, or complex orthopedic workup, ask about teleradiology or specialist referral.',
        why_it_matters: 'A specialist miss on a chest X-ray can delay a cancer diagnosis by months. The $50–$150 for a teleradiology read is worth it for complex cases.',
      },
      {
        question: 'Can the images be shared with a specialist or emergency clinic if needed?',
        listen_for: 'Yes should be the immediate answer. If the clinic uses non-standard formats, ask how you can get a copy.',
        why_it_matters: 'If your pet later goes to an emergency clinic or specialist, having the images available prevents duplicate radiation exposure and duplicate costs.',
      },
    ],
    sort_order: 13,
    is_active: true,
  },
  {
    id: '14',
    slug: 'ultrasound-abdominal',
    display_name: 'Ultrasound — Abdominal',
    clinical_name: 'Abdominal Sonography',
    category: 'diagnostics',
    species: 'both',
    description_plain:
      'A real-time imaging study using sound waves to visualize organs inside the abdomen, including the liver, spleen, kidneys, bladder, lymph nodes, and GI tract. Ultrasound is painless and doesn\'t require anesthesia in most pets (just a shaved belly area). It\'s the best tool for detecting masses, fluid accumulation, bladder stones, and organ changes that X-rays can\'t show in detail.',
    questions_to_ask: [
      {
        question: 'Is this performed by a board-certified radiologist or a general vet?',
        listen_for: 'Board-certified radiologists (ACVR) provide the most accurate reads. General vet ultrasound is appropriate for screening but has real limitations.',
        why_it_matters: 'A missed mass or early organ change can delay diagnosis by months. For anything more than a basic screen, a specialist read is worth the premium.',
      },
      {
        question: 'Does the price include a written interpretation/report?',
        listen_for: 'A formal report should be standard. If not included, ask what the add-on price is — and get one anyway for your records.',
        why_it_matters: 'A written report creates a documented baseline. If your pet\'s condition changes, the next provider can compare findings rather than starting from scratch.',
      },
      {
        question: 'Is sedation included if needed?',
        listen_for: 'Most abdominal ultrasounds don\'t require sedation — just a calm pet and a shaved belly. If sedation is recommended, ask whether it\'s truly necessary.',
        why_it_matters: 'Sedation adds cost and risk. For a routine abdominal screen, sedation should rarely be necessary.',
      },
      {
        question: 'Can you do a guided needle aspirate (FNA) at the same appointment if something is found?',
        listen_for: 'Ideally yes. Same-session FNA is more efficient and avoids a second anesthesia or sedation event. Ask upfront about the add-on cost.',
        why_it_matters: 'If a mass is found, you\'ll want to know what it is. Scheduling a same-appointment aspirate saves time, money, and emotional stress.',
      },
      {
        question: 'How long will results take if images are sent out for review?',
        listen_for: 'Teleradiology reads typically return in 4–24 hours. A send-out that takes longer than 24 hours for an urgent case should be escalated.',
        why_it_matters: 'For a symptomatic pet, 24–48 hours for imaging results can meaningfully change the treatment timeline and outcome.',
      },
    ],
    sort_order: 14,
    is_active: true,
  },

  // SURGICAL / ROUTINE
  {
    id: '15',
    slug: 'spay-dog-under-50',
    display_name: 'Spay — Dog Under 50 lbs',
    clinical_name: 'Ovariohysterectomy',
    category: 'surgical_routine',
    species: 'dog',
    description_plain:
      'Surgical removal of the ovaries and uterus to permanently sterilize a female dog and eliminate heat cycles. Spaying before the first heat significantly reduces mammary cancer risk and eliminates the risk of a life-threatening uterine infection called pyometra. Price varies widely based on dog size, age, and whether the clinic is a low-cost spay-neuter facility vs. a full-service hospital.',
    questions_to_ask: [
      {
        question: 'Does the price include pre-surgical bloodwork, anesthesia, and take-home pain medication?',
        listen_for: 'All three should be included or clearly itemized. A quote that omits pain medication is a concern — post-op pain management is standard of care.',
        why_it_matters: 'The difference between a "$250 spay" and a "$500 spay" often comes down to what\'s included. Getting the itemized breakdown reveals the true cost.',
      },
      {
        question: 'Is IV catheter and fluids included, or extra?',
        listen_for: 'IV access and fluids should be standard for any procedure under general anesthesia. If they\'re extra, expect $50–$120 added to the bill.',
        why_it_matters: 'IV fluids support blood pressure during anesthesia and provide emergency medication access. This is non-negotiable safety equipment.',
      },
      {
        question: 'What anesthesia monitoring equipment is used?',
        listen_for: 'Pulse oximetry, blood pressure monitor, ECG, capnography. These are the minimum standards. A clinic that can\'t name these is cutting corners.',
        why_it_matters: 'Anesthesia complications in spayed-age dogs are rare but serious. Proper monitoring is the difference between catching a complication and missing it.',
      },
      {
        question: 'Is an E-collar and recheck visit included?',
        listen_for: 'E-collar should be sent home; a recheck at 10–14 days is standard. If they\'re not included, ask the add-on cost.',
        why_it_matters: 'Wound complications from self-licking are the most common post-op issue. An E-collar prevents this — and a recheck catches any healing problems early.',
      },
      {
        question: 'How long until she can return to normal activity?',
        listen_for: '10–14 days of restricted activity is standard. If you\'re told she can run and jump immediately, that\'s a red flag — incisions need time to heal internally.',
        why_it_matters: 'Exercise restriction compliance significantly affects healing. Knowing the timeline helps you plan logistics (crating, leash walks, no stairs).',
      },
    ],
    sort_order: 15,
    is_active: true,
  },
  {
    id: '16',
    slug: 'spay-dog-over-50',
    display_name: 'Spay — Dog Over 50 lbs',
    clinical_name: 'Ovariohysterectomy',
    category: 'surgical_routine',
    species: 'dog',
    description_plain:
      'The same ovary and uterus removal surgery as a standard spay, but for larger dogs requiring more anesthesia, longer surgical time, and more complex suture work. Large and giant breed dogs also carry higher anesthesia risk, making pre-surgical bloodwork and careful monitoring even more critical. Giant breeds over 100 lbs may be quoted at a separate, higher tier.',
    questions_to_ask: [
      {
        question: 'Does the price change if my dog is over 80 or 100 lbs?',
        listen_for: 'Most large-dog spay pricing has a second tier at 80 or 100 lbs. Know in advance whether your dog falls in the mid or top tier.',
        why_it_matters: 'A quote for a "70-lb tier" spay can jump significantly at 100 lbs. Knowing the cutoffs prevents surprises.',
      },
      {
        question: 'Is pre-surgical bloodwork included in this quote?',
        listen_for: 'For large dogs, bloodwork is especially important before anesthesia — large breeds can have breed-specific risks that bloodwork helps detect.',
        why_it_matters: 'Bloodwork before anesthesia is standard of care for any dog over 5–7 years, and strongly recommended for all large breeds regardless of age.',
      },
      {
        question: 'Do you have a dedicated anesthesia technician for large-dog procedures?',
        listen_for: 'Large dogs require more anesthetic agent, more monitoring, and careful dosing. A dedicated anesthesia tech (not the same person performing surgery) is ideal.',
        why_it_matters: 'Large-dog anesthesia is more demanding than small-dog anesthesia. Confirming proper staffing is a reasonable quality check.',
      },
      {
        question: 'Does the price include take-home pain medication?',
        listen_for: 'Post-op pain medication (typically NSAIDs and/or opioids for 3–5 days) should be included. If not, expect a $30–$80 add-on.',
        why_it_matters: 'Large dogs have more surgical site tension and typically experience more post-op pain than small dogs. Adequate pain management is critical to recovery.',
      },
      {
        question: 'Is a recheck appointment included?',
        listen_for: 'A suture or staple check at 10–14 days should be included at no extra charge. If it\'s not, clarify the cost.',
        why_it_matters: 'Suture removal and wound assessment are standard parts of surgical follow-up — not an upsell.',
      },
    ],
    sort_order: 16,
    is_active: true,
  },
  {
    id: '17',
    slug: 'neuter-dog-under-50',
    display_name: 'Neuter — Dog Under 50 lbs',
    clinical_name: 'Orchiectomy',
    category: 'surgical_routine',
    species: 'dog',
    description_plain:
      'Surgical removal of the testicles to permanently sterilize a male dog, eliminating the ability to reproduce and reducing roaming and marking behavior. Neutering also eliminates testicular cancer risk and greatly reduces the risk of prostate disease. This is generally a simpler and less expensive procedure than a spay, with a faster recovery.',
    questions_to_ask: [
      {
        question: 'Are both testicles descended? An undescended testicle (cryptorchid) costs significantly more to remove.',
        listen_for: 'If one or both testicles are retained in the abdomen, this becomes an abdominal surgery — often 2–3x the standard neuter price.',
        why_it_matters: 'Retained testicles have a significantly higher cancer risk and must be removed — but the cost difference from a routine neuter is substantial. Confirm before surgery.',
      },
      {
        question: 'Does the price include anesthesia, post-op pain meds, and an E-collar?',
        listen_for: 'Neuters are simpler than spays, but these items should still be included. Any that aren\'t should be clearly itemized.',
        why_it_matters: 'Male neuters heal faster than spays, but proper pain management and wound protection still matter. Confirm what\'s in the quote.',
      },
      {
        question: 'Is pre-surgical bloodwork required and included?',
        listen_for: 'Bloodwork for young, healthy male dogs is more often optional than for spays. If it\'s being pushed hard on a 1-year-old with no health concerns, it may be an unnecessary add-on.',
        why_it_matters: 'For young dogs, bloodwork pre-neuter is often not medically required. Knowing whether it\'s included or extra prevents billing surprises.',
      },
      {
        question: 'How long is the recovery before he can exercise normally?',
        listen_for: '7–10 days of restricted activity for a routine neuter. Jumping and rough play should be avoided until sutures are removed or dissolved.',
        why_it_matters: 'Male dogs often want to return to full activity faster than is safe. Knowing the timeline helps you set the right expectations and prevent complications.',
      },
    ],
    sort_order: 17,
    is_active: true,
  },
  {
    id: '18',
    slug: 'neuter-dog-over-50',
    display_name: 'Neuter — Dog Over 50 lbs',
    clinical_name: 'Orchiectomy',
    category: 'surgical_routine',
    species: 'dog',
    description_plain:
      'Orchiectomy for larger male dogs, which requires more anesthesia and slightly longer surgical time than for smaller breeds. Large breed dogs may also have size-specific timing considerations — some evidence suggests delaying neutering until skeletal maturity for giant breeds. The price gap between small and large dog neuters is less dramatic than with spays.',
    questions_to_ask: [
      {
        question: 'Is there a size cutoff where the price increases again — e.g., over 80 or 100 lbs?',
        listen_for: 'Ask for the exact weight tiers. Many practices have a third pricing tier for dogs over 80 or 100 lbs.',
        why_it_matters: 'A "large dog neuter" quote can vary significantly depending on where your dog falls in the weight tiers.',
      },
      {
        question: 'Is pre-surgical bloodwork required and included?',
        listen_for: 'Large dogs over 5 years should definitely have pre-surgical bloodwork. For younger large breeds, it\'s optional but reasonable.',
        why_it_matters: 'Large breeds are more prone to certain breed-specific conditions (e.g., cardiac issues in Dobermans) that bloodwork can screen for before anesthesia.',
      },
      {
        question: 'What anesthesia monitoring do you use for large dogs?',
        listen_for: 'Same standards as for spays — pulse oximetry, blood pressure, ECG, capnography. Large dogs need the same monitoring as small dogs.',
        why_it_matters: 'Large breed dogs can have underlying cardiac conditions that only manifest under anesthesia stress. Proper monitoring is safety-critical.',
      },
      {
        question: 'Does the price include post-op pain medication?',
        listen_for: 'Yes should be the answer. Large dog neuters are more involved than small-dog neuters and warrant appropriate pain management.',
        why_it_matters: 'Inadequate pain management leads to stress, delayed healing, and potential self-trauma to the surgical site.',
      },
    ],
    sort_order: 18,
    is_active: true,
  },
  {
    id: '19',
    slug: 'spay-cat',
    display_name: 'Spay — Cat',
    clinical_name: 'Ovariohysterectomy',
    category: 'surgical_routine',
    species: 'cat',
    description_plain:
      'Surgical removal of the uterus and ovaries in a female cat to prevent pregnancy, eliminate heat cycles, and reduce the risk of mammary cancer and pyometra. Cat spays are generally simpler and less expensive than dog spays due to smaller size and anatomy. Low-cost spay-neuter clinics offer this at a steep discount compared to full-service hospitals, though monitoring standards can vary.',
    questions_to_ask: [
      {
        question: 'Is this price all-inclusive, or are anesthesia, pain meds, and E-collar extra?',
        listen_for: 'Budget/low-cost clinics often advertise a low base price and add items at checkout. Full-service practices typically include most items. Ask for an itemized list.',
        why_it_matters: 'A $100 spay that adds $80 in extras is a $180 spay. An itemized quote lets you compare apples to apples.',
      },
      {
        question: 'What pain management protocol do you use?',
        listen_for: 'Pre-operative pain relief plus take-home medication for 2–3 days is the current standard. "She\'ll be fine — cats hide pain well" is not an acceptable answer.',
        why_it_matters: 'Cats are stoic about pain, which makes veterinary pain management for them historically underprescribed. A practice that proactively mentions pain management is prioritizing animal welfare.',
      },
      {
        question: 'What anesthesia monitoring is standard here?',
        listen_for: 'Pulse oximetry, blood pressure, ECG, and ideally capnography. Cats are higher-risk per-procedure than dogs.',
        why_it_matters: 'Cats are more sensitive to anesthesia than dogs on a per-kilo basis and have narrower safety margins. A practice with comprehensive monitoring is worth a small premium.',
      },
      {
        question: 'Is a recheck visit included?',
        listen_for: 'For most cat spays, sutures are absorbable, but a recheck to check the incision at 10–14 days is still good practice.',
        why_it_matters: 'Knowing whether follow-up is included or an extra charge helps you plan total cost of care.',
      },
      {
        question: 'Is there a price difference if she is currently in heat?',
        listen_for: 'Yes — spaying a cat in heat is more complex due to engorged blood vessels and typically adds $25–$75 to the cost.',
        why_it_matters: 'If you\'re unsure whether your cat is in heat, ask the vet to check and confirm pricing before you\'re already in the exam room.',
      },
    ],
    sort_order: 19,
    is_active: true,
  },
  {
    id: '20',
    slug: 'neuter-cat',
    display_name: 'Neuter — Cat',
    clinical_name: 'Orchiectomy',
    category: 'surgical_routine',
    species: 'cat',
    description_plain:
      'Surgical removal of the testicles in a male cat — one of the simplest and quickest procedures in veterinary medicine. Neutering eliminates spraying behavior in most cats, reduces fighting and roaming, and prevents testicular cancer. Recovery is very fast; most cats are back to normal within 24–48 hours.',
    questions_to_ask: [
      {
        question: 'Is pain medication included or recommended given how quick this surgery is?',
        listen_for: 'Even for a fast procedure, pre-op and post-op analgesia is appropriate. Pain management not being offered at all is a concern.',
        why_it_matters: 'Even a 5-minute procedure causes pain. A practice that doesn\'t offer pain management for a cat neuter is behind current standards.',
      },
      {
        question: 'Are both testicles descended? A cryptorchid neuter costs more.',
        listen_for: 'If a testicle is retained, the vet should have confirmed this on exam before quoting. If not examined yet, ask them to check.',
        why_it_matters: 'A cryptorchid neuter requires abdominal surgery — typically 3–4x the standard neuter cost. Knowing before surgery sets expectations.',
      },
      {
        question: 'Does the price include an E-collar?',
        listen_for: 'Cat neuters heal very quickly (24–48 hours), and many vets don\'t include or recommend an E-collar. Confirm the incision monitoring plan.',
        why_it_matters: 'Male cat neuters are low-complication, but self-licking can still cause issues. Knowing what wound care is expected helps you monitor at home.',
      },
      {
        question: 'Do I need a pre-op exam if he was just seen recently?',
        listen_for: 'Many practices require a pre-surgical exam (and charge for it) even if you were just in last month. Ask if the exam fee can be waived given a recent visit.',
        why_it_matters: 'Pre-op exams for neuters are reasonable, but a recently-seen cat doesn\'t need a full exam fee. Asking can save $50–$80.',
      },
    ],
    sort_order: 20,
    is_active: true,
  },

  // SURGICAL / COMMON
  {
    id: '21',
    slug: 'mass-removal-small',
    display_name: 'Mass / Lump Removal — Small',
    clinical_name: 'Excision, Benign',
    category: 'surgical_common',
    species: 'both',
    description_plain:
      'Surgical removal of a small skin or subcutaneous mass, such as a lipoma, cyst, or small benign tumor. Most lumps in pets are benign, but removal is recommended when they grow rapidly, interfere with movement, or the diagnosis is uncertain. A biopsy of the removed tissue is strongly recommended to confirm the diagnosis and ensure complete removal.',
    questions_to_ask: [
      {
        question: 'Does the price include sending the mass for biopsy? What does biopsy cost separately?',
        listen_for: 'Biopsy is typically separate ($100–$250) and should always be recommended — even for "obviously benign" lumps. Vets who skip biopsy are cutting important corners.',
        why_it_matters: '15–20% of "obviously benign" lumps turn out to be something more significant on pathology. Skipping the biopsy is false economy.',
      },
      {
        question: 'Is anesthesia included, or is this done with local anesthetic only?',
        listen_for: 'Small surface masses in compliant pets can sometimes be done under local anesthetic. Anything deeper or in a sensitive location requires full anesthesia.',
        why_it_matters: 'Local vs. general anesthesia has a significant cost difference. Knowing which applies to your pet prevents billing surprises.',
      },
      {
        question: 'What size or location is considered "small" — where does pricing change?',
        listen_for: 'Most practices define "small" as under 2–3 cm. Location matters too — a mass on the face or over a joint is more complex than one on the flank.',
        why_it_matters: 'A mass that the vet upgrades from "small" to "complex" at surgery can significantly increase the final bill. Setting clear expectations upfront prevents disputes.',
      },
      {
        question: "If margins aren't clean on the biopsy, what's the plan and cost for revision?",
        listen_for: 'A clear conversation about re-excision with wider margins if the pathology comes back "incomplete excision." This is common with certain mast cell tumors.',
        why_it_matters: 'Incomplete excision of a malignant mass requires revision surgery. Knowing this possibility upfront helps you plan financially and emotionally.',
      },
    ],
    sort_order: 21,
    is_active: true,
  },
  {
    id: '22',
    slug: 'tooth-extraction-single',
    display_name: 'Tooth Extraction — Single',
    clinical_name: 'Dental Extraction',
    category: 'surgical_common',
    species: 'both',
    description_plain:
      'Removal of a single tooth under general anesthesia, most often due to severe periodontal disease, fracture, or tooth resorption in cats. Extractions require dental X-rays to plan properly and confirm complete root removal. A single simple extraction is typically an add-on to a dental cleaning, though complicated multi-rooted teeth can take significantly longer and cost more.',
    questions_to_ask: [
      {
        question: 'Is this quoted as an add-on to a cleaning, or a standalone procedure?',
        listen_for: 'Single extractions are almost always done during a dental cleaning. A standalone extraction quote will be higher because it includes its own anesthesia setup.',
        why_it_matters: 'Understanding the context prevents double-paying for anesthesia. Confirm whether the extraction cost is the add-on price or the total procedure price.',
      },
      {
        question: 'Are dental X-rays included?',
        listen_for: 'X-rays are mandatory for any dental extraction — they confirm complete root removal and guide the approach. If not included, this is a standard-of-care concern.',
        why_it_matters: 'Extracting a tooth without X-rays risks leaving root fragments behind — which can cause chronic infection, pain, and the need for a second procedure.',
      },
      {
        question: 'Is this a simple or surgical extraction — will the tooth be sectioned?',
        listen_for: 'Multi-rooted teeth (most back teeth) require sectioning before extraction — this is more time-intensive and expensive than a simple extraction.',
        why_it_matters: 'Simple and surgical extractions are often priced very differently. Knowing which applies to your pet\'s specific tooth prevents cost surprises.',
      },
      {
        question: 'Does the price include anesthesia, or is this just the extraction fee?',
        listen_for: 'If done during a cleaning, the anesthesia is already in the cleaning quote. If standalone, anesthesia must be included or separately itemized.',
        why_it_matters: 'Extraction fees quoted without anesthesia can mislead pet owners about the true cost of the procedure.',
      },
      {
        question: "What's the pain management plan after the extraction?",
        listen_for: 'NSAID (e.g., meloxicam) for 3–5 days is standard. More complex extractions may also include an opioid component.',
        why_it_matters: 'Dental pain is significant. Proper pain management speeds healing and prevents self-trauma behavior like pawing at the face.',
      },
    ],
    sort_order: 22,
    is_active: true,
  },
  {
    id: '23',
    slug: 'tooth-extraction-multiple',
    display_name: 'Tooth Extraction — Multiple / Complicated',
    clinical_name: 'Multiple Dental Extractions',
    category: 'surgical_common',
    species: 'both',
    description_plain:
      'Removal of multiple teeth or a single complicated multi-rooted tooth requiring sectioning and surgical elevation. This is most often needed after a dental cleaning reveals advanced periodontal disease or in cats with widespread tooth resorption. Total cost depends heavily on how many teeth are affected — something not fully known until the pet is under anesthesia and X-rayed.',
    questions_to_ask: [
      {
        question: 'Can you give me a cost range — best case and worst case — based on what you see pre-operatively?',
        listen_for: 'A specific dollar range, not "it depends." A vet experienced with dental work can give you a realistic range based on the pre-op oral exam.',
        why_it_matters: 'Multiple-extraction cases can range from $300 to $1,500+ in add-ons. Without a range, you\'re effectively signing a blank check.',
      },
      {
        question: 'Do you call before proceeding if extractions exceed a certain dollar threshold?',
        listen_for: 'Yes — reputable practices establish a client-approved authorization limit and call you if extractions will exceed it.',
        why_it_matters: 'Your pet is under anesthesia and can\'t consent. You need to be the decision-maker if costs escalate. Confirming this protocol is non-negotiable.',
      },
      {
        question: 'Are X-rays included in the extraction pricing?',
        listen_for: 'Yes — full-mouth dental X-rays are standard for multi-extraction cases. Per-tooth X-rays should be included in the extraction pricing, not billed separately.',
        why_it_matters: 'X-rays are medically required for multi-extraction procedures. If they\'re billed separately, you\'re effectively being charged twice for the diagnostic work.',
      },
      {
        question: 'How is pain managed during and after a procedure this extensive?',
        listen_for: 'Local nerve blocks during the procedure plus take-home NSAIDs and possibly opioids for 5–7 days. Extensive extractions warrant more aggressive post-op pain management.',
        why_it_matters: 'More extractions = more pain. Proper management isn\'t just humane — it reduces stress, speeds healing, and prevents post-op complications.',
      },
      {
        question: 'Will my pet need a soft diet afterward, and for how long?',
        listen_for: 'Typically 7–14 days for soft food after major extractions. Cats with extensive extractions may need a longer transition.',
        why_it_matters: 'Dietary changes after dental surgery affect your logistics. Knowing in advance lets you prepare the right food before surgery day.',
      },
    ],
    sort_order: 23,
    is_active: true,
  },
  {
    id: '24',
    slug: 'foreign-body-removal',
    display_name: 'Foreign Body Removal — Stomach / Intestine',
    clinical_name: 'Gastrointestinal Foreign Body Surgery',
    category: 'surgical_common',
    species: 'both',
    description_plain:
      'Emergency or urgent surgery to remove an object your pet swallowed that is stuck in the stomach or intestines and cannot pass on its own. Common culprits include toys, socks, bones, corn cobs, and linear foreign bodies like string or ribbon (especially dangerous in cats). This is a high-cost surgery that often happens on short notice — pet insurance or an emergency fund is strongly recommended.',
    questions_to_ask: [
      {
        question: 'Has endoscopy been considered as a less invasive option?',
        listen_for: 'For objects in the esophagus or stomach that are accessible, endoscopy is less invasive, faster, and cheaper than surgery ($600–$1,200 vs. $2,000–$5,000). Ask why if it\'s not being offered.',
        why_it_matters: 'The difference between endoscopic and surgical removal can be thousands of dollars and weeks of recovery time. Confirming all options were considered is reasonable.',
      },
      {
        question: 'What does the full estimate include — surgery, anesthesia, hospitalization, and follow-up?',
        listen_for: 'An itemized estimate covering surgery, anesthesia, 1–2 day post-op hospitalization, IV fluids, medications, and a follow-up visit.',
        why_it_matters: 'GI foreign body surgery is one of the most common $3,000–$6,000 vet bills. An itemized estimate lets you plan for the total cost, not just the surgical fee.',
      },
      {
        question: 'How long will hospitalization typically be after this surgery?',
        listen_for: '1–2 days for uncomplicated cases; longer if intestinal resection was needed. Hospitals with overnight monitoring charge more but are appropriate for this level of surgery.',
        why_it_matters: 'Post-op hospitalization can add $300–$600/day. Knowing the expected length helps you anticipate total cost.',
      },
      {
        question: 'Are there additional costs if intestinal resection (bowel removal) is needed?',
        listen_for: 'Yes — intestinal resection significantly increases surgical time, anesthesia, and post-op care. The extra cost can be $500–$2,000 more.',
        why_it_matters: 'Whether resection is needed isn\'t always known until the surgeon is inside. Understanding this possibility prevents shock at the final bill.',
      },
      {
        question: 'What payment options or financing do you offer?',
        listen_for: 'CareCredit, Scratch Pay, or payment plans are common. Emergency facilities should have clear financing options.',
        why_it_matters: 'This procedure is frequently an emergency with no financial preparation time. Knowing your payment options upfront reduces stress in a stressful moment.',
      },
    ],
    sort_order: 24,
    is_active: true,
  },
  {
    id: '25',
    slug: 'cruciate-repair-tplo',
    display_name: 'Cruciate Repair — Dog',
    clinical_name: 'Tibial Plateau Leveling Osteotomy (TPLO)',
    category: 'surgical_common',
    species: 'dog',
    description_plain:
      'Surgery to stabilize a dog\'s knee joint after rupture of the cranial cruciate ligament (CCL) — the equivalent of a human ACL tear. TPLO is the gold-standard procedure for medium and large dogs: it repositions the tibia to change joint mechanics rather than replacing the ligament directly. Without surgery, most dogs over 30 lbs develop progressive arthritis; with TPLO, over 90% return to full activity.',
    questions_to_ask: [
      {
        question: "Is TPLO right for my dog's size, or would a TTA or extracapsular repair be considered?",
        listen_for: 'For dogs over 30 lbs, TPLO is gold standard. Extracapsular (lateral suture) repair is appropriate for dogs under 20–25 lbs. A vet recommending extracapsular repair for a 60-lb dog warrants more questions.',
        why_it_matters: 'The right procedure depends heavily on your dog\'s size and activity level. The wrong procedure may fail or require revision — at full cost again.',
      },
      {
        question: 'Is this performed by a board-certified surgeon?',
        listen_for: 'TPLO should be performed by a board-certified veterinary surgeon (DACVS or similar). A general practitioner performing TPLO warrants inquiry about their specific training and case volume.',
        why_it_matters: 'TPLO complication rates are strongly correlated with surgeon experience. A board-certified surgeon at a specialty center is worth the premium.',
      },
      {
        question: 'What does the estimate include — surgery, implants, anesthesia, X-rays, and post-op rechecks?',
        listen_for: 'An itemized estimate with all components listed. TPLO implants (plate and screws) alone cost $300–$600. All imaging, anesthesia, and at least 2 post-op rechecks should be included.',
        why_it_matters: 'TPLO quotes range from $3,500 to $7,000+ depending on what\'s included. An itemized breakdown lets you compare quotes fairly.',
      },
      {
        question: "What's the rehabilitation protocol and timeline for return to activity?",
        listen_for: '8–12 weeks of progressive rehabilitation is standard. Formal physical therapy/rehab is often recommended for working dogs or athletes.',
        why_it_matters: 'Return-to-activity timeline affects your dog\'s quality of life for months. Physical therapy can significantly improve outcomes but adds $100–$200 per session.',
      },
      {
        question: "What's the risk of the other knee tearing, and how common is that?",
        listen_for: '30–50% of dogs with a torn CCL will tear the other knee within 1–2 years. This is a pre-existing bilateral condition, not a complication of surgery.',
        why_it_matters: 'If the other knee tears, you\'re looking at another $3,500–$7,000 surgery. This risk changes how urgently some owners pursue pet insurance.',
      },
    ],
    sort_order: 25,
    is_active: true,
  },

  // EMERGENCY
  {
    id: '26',
    slug: 'emergency-exam-stabilization',
    display_name: 'Emergency Exam + Stabilization',
    clinical_name: 'Emergency Triage and Initial Stabilization',
    category: 'emergency',
    species: 'both',
    description_plain:
      'The initial evaluation and emergency treatment your pet receives when you arrive at an emergency clinic with an urgent or life-threatening condition. This includes triage assessment and stabilization measures like oxygen, initial medications, or wound care — before more advanced diagnostics and treatment. Emergency clinics charge higher base fees than daytime practices because they staff 24/7 with specialists on call.',
    questions_to_ask: [
      {
        question: "What's the emergency exam fee, and what does it include?",
        listen_for: 'A clear dollar amount and list of what\'s included (triage, initial exam, stabilization). Many emergency clinics charge $100–$200+ just to walk in the door.',
        why_it_matters: 'Emergency exam fees vary widely — $75 at some clinics to $250+ at 24/7 specialty hospitals. Knowing the baseline fee is the foundation for any further financial planning.',
      },
      {
        question: 'Will I receive an estimate before any additional diagnostics or treatments are started?',
        listen_for: 'A reputable emergency clinic will provide a written estimate before proceeding with anything beyond initial triage. Declining a written estimate is a major red flag.',
        why_it_matters: 'Emergency care can escalate to thousands of dollars rapidly. A written estimate before treatment begins is your financial protection.',
      },
      {
        question: 'What payment options or financing do you offer?',
        listen_for: 'CareCredit, Scratch Pay, payment plans. Emergency clinics typically require a deposit before treatment. Knowing the options before you\'re overwhelmed helps.',
        why_it_matters: 'Emergency situations allow no time to plan finances. Knowing the payment landscape the moment you arrive lets you focus on your pet.',
      },
      {
        question: 'Is there a board-certified emergency specialist on staff tonight?',
        listen_for: 'True emergency and critical care specialists (DACVECC) are the highest-level providers. Many emergency hospitals staff general emergency veterinarians — excellent, but not board-certified specialists.',
        why_it_matters: 'For a critical pet, the level of expertise on staff can be the difference between life and death. This isn\'t about cost — it\'s about knowing what level of care is available.',
      },
    ],
    sort_order: 26,
    is_active: true,
  },
  {
    id: '27',
    slug: 'iv-fluids-per-day',
    display_name: 'IV Fluids — Hospitalization Per Day',
    clinical_name: 'Intravenous Fluid Therapy',
    category: 'emergency',
    species: 'both',
    description_plain:
      'A daily hospitalization charge covering IV catheter placement, continuous fluids, and nursing care for a pet receiving in-hospital treatment. IV fluids are used for dehydration, kidney disease, post-surgical recovery, toxin treatment, and many other serious conditions. Day rates vary enormously between general practices, emergency hospitals, and specialty referral centers.',
    questions_to_ask: [
      {
        question: 'What does the daily hospitalization fee include — fluids, medications, monitoring, and nursing?',
        listen_for: 'Fluids, nursing checks, basic monitoring, and routine medications should be included. Specialty medications and diagnostics are often separate.',
        why_it_matters: 'A $200/day hospitalization that charges separately for everything can become $500/day. Understanding what\'s included prevents sticker shock on discharge day.',
      },
      {
        question: 'Will I receive updates, and how often?',
        listen_for: 'Once or twice daily updates should be standard. Ask for a specific call time and how to reach the clinic for urgent updates.',
        why_it_matters: 'Communication about a hospitalized pet is not optional. Establishing expectations prevents frantic unanswered calls during a stressful time.',
      },
      {
        question: 'Is there a visiting policy if I want to come see my pet?',
        listen_for: 'Most general practice hospitals allow visiting during business hours. Emergency hospitals often have more restricted visiting due to ICU protocols.',
        why_it_matters: 'Visit policies affect both your peace of mind and your pet\'s recovery — familiar faces and voices reduce stress in hospitalized animals.',
      },
      {
        question: "What's the estimated length of stay?",
        listen_for: 'A range rather than a definitive answer is reasonable — conditions evolve. But "we\'ll keep them as long as needed" with no guidance is not.',
        why_it_matters: 'At $200–$600/day for hospitalization, every additional day adds significant cost. Understanding the expected timeline helps you plan.',
      },
      {
        question: 'Who monitors pets overnight?',
        listen_for: 'A veterinarian or registered technician should be physically present overnight, not just "on call." For a critically ill pet, "on call" is insufficient.',
        why_it_matters: 'Overnight care standards vary enormously between facilities. For a sick pet, continuous overnight monitoring can be life-saving.',
      },
    ],
    sort_order: 27,
    is_active: true,
  },
  {
    id: '28',
    slug: 'overnight-icu-stay',
    display_name: 'Overnight ICU Stay',
    clinical_name: 'Intensive Care Unit Hospitalization',
    category: 'emergency',
    species: 'both',
    description_plain:
      'An overnight stay in the intensive care unit for critically ill pets requiring continuous monitoring and intervention. ICU stays include constant nursing supervision, vital sign monitoring, oxygen support if needed, and around-the-clock treatment. ICU rates are significantly higher than standard ward hospitalization and are most often needed after major surgery, respiratory crises, severe toxin exposure, or multi-organ failure.',
    questions_to_ask: [
      {
        question: 'Is this ICU or standard ward hospitalization — is there continuous monitoring overnight?',
        listen_for: 'ICU means continuous monitoring with staff physically present at all times. Standard ward monitoring varies. Make sure you know which level of care your pet is receiving.',
        why_it_matters: 'The price difference between ICU and standard ward ($400–$800 vs. $150–$300/night) should reflect a meaningful difference in care level — confirm it does.',
      },
      {
        question: 'Is a veterinarian or technician physically present all night?',
        listen_for: '"On-call" is not the same as physically present. For true ICU-level monitoring, a qualified person should be with the patients throughout the night.',
        why_it_matters: 'Critically ill pets can deteriorate rapidly. The difference between a doctor being present and being on-call can be 30 minutes — a meaningful gap in a crash scenario.',
      },
      {
        question: 'What does the ICU rate include vs. bill separately?',
        listen_for: 'ICU monitoring, oxygen therapy (if needed), IV fluid management, and nursing care should be in the base rate. Additional diagnostics and specialty medications are typically separate.',
        why_it_matters: 'ICU rates vary from $400 to $1,200 per night. Understanding what\'s included vs. billed separately allows you to anticipate total cost.',
      },
      {
        question: "What's the plan if my pet deteriorates overnight — how will you reach me?",
        listen_for: 'A specific protocol for emergent calls — who decides, what threshold triggers a call, how they\'ll reach you. You should be reachable by phone at any hour during a critical admission.',
        why_it_matters: 'If your pet\'s condition changes critically overnight, you may need to make real-time decisions. Establishing this protocol upfront is essential.',
      },
    ],
    sort_order: 28,
    is_active: true,
  },
  {
    id: '29',
    slug: 'bloat-surgery-gdv',
    display_name: 'Bloat Surgery',
    clinical_name: 'Gastric Dilatation-Volvulus (GDV) Correction',
    category: 'emergency',
    species: 'dog',
    description_plain:
      'Emergency surgery for gastric dilatation-volvulus (GDV), where the stomach fills with gas and twists on itself — a rapidly fatal condition if not treated within hours. Large, deep-chested breeds like Great Danes, German Shepherds, Standard Poodles, and Weimaraners are at highest risk. Surgery involves decompressing the stomach, untwisting it, and permanently attaching it to the body wall (gastropexy) to prevent recurrence.',
    questions_to_ask: [
      {
        question: 'Does the estimate include the full surgery, ICU stay, and post-op monitoring?',
        listen_for: 'A GDV correction estimate should include surgery, anesthesia, ICU hospitalization (typically 1–2 days), IV fluids, medications, and a post-op recheck.',
        why_it_matters: 'GDV surgery estimates range from $2,500 to $7,500+. An itemized estimate reveals whether you\'re comparing similar total costs across facilities.',
      },
      {
        question: 'What is the prognosis — has the stomach tissue already lost blood supply?',
        listen_for: 'An honest assessment. Stomach tissue necrosis dramatically worsens prognosis and increases cost due to the need for partial gastrectomy.',
        why_it_matters: 'GDV has an 80–90% survival rate with prompt treatment. With necrosis, survival drops significantly. Knowing the prognosis informs the difficult decisions that may need to be made.',
      },
      {
        question: 'Is a gastropexy (stomach tacking) included to prevent recurrence?',
        listen_for: 'Yes — gastropexy is standard in GDV surgery and should always be performed to prevent recurrence. If it\'s not being done, ask why.',
        why_it_matters: 'Without gastropexy, GDV will likely recur — and the second episode is often fatal. This is non-negotiable and should be included in the GDV surgery quote.',
      },
      {
        question: 'What is the survival rate for dogs who reach surgery in this condition?',
        listen_for: '80–90% with prompt surgery, declining with delay. The vet should be able to give you a realistic estimate based on your dog\'s specific condition.',
        why_it_matters: 'Understanding the prognosis upfront helps you weigh the financial commitment of a $3,000–$7,000 surgery against a realistic outcome.',
      },
      {
        question: 'Can a preventive gastropexy be done electively for high-risk breeds?',
        listen_for: 'Yes — prophylactic gastropexy during a neuter or spay in a high-risk breed costs $200–$500 extra but can prevent a $5,000+ emergency.',
        why_it_matters: 'If you have a high-risk breed, this information has real preventive value regardless of the current situation.',
      },
    ],
    sort_order: 29,
    is_active: true,
  },
  {
    id: '30',
    slug: 'toxin-treatment',
    display_name: 'Toxin / Poison Treatment',
    clinical_name: 'Decontamination and Toxicological Monitoring',
    category: 'emergency',
    species: 'both',
    description_plain:
      'Emergency treatment when a pet has ingested a toxic substance, which may include inducing vomiting, administering activated charcoal, IV fluids, and monitoring for organ damage. Common culprits include xylitol, grapes/raisins, chocolate, rat poison, Tylenol (especially dangerous in cats), and human medications. Cost varies enormously based on what was ingested and how long ago — some toxins require only short observation while others trigger multi-day hospitalization.',
    questions_to_ask: [
      {
        question: 'Have you contacted the ASPCA Poison Control hotline for this specific toxin? (They charge ~$95 but have a toxicologist on call 24/7.)',
        listen_for: 'Most experienced emergency vets consult ASPCA Poison Control on toxin cases. If they haven\'t and you know the specific toxin, mention this option proactively.',
        why_it_matters: 'ASPCA Poison Control\'s $95 fee is often the single best investment in a toxin emergency — they have a database of thousands of substances and can specify exact decontamination protocols.',
      },
      {
        question: 'How long ago did the ingestion happen — is inducing vomiting still appropriate?',
        listen_for: 'Vomiting induction is typically only appropriate within 1–2 hours of ingestion for most toxins, and contraindicated for some (caustic substances, sharp objects, certain medications).',
        why_it_matters: 'This ensures the vet has gathered the critical timeline information. If vomiting induction is done outside the appropriate window, it may be ineffective or harmful — and still billed.',
      },
      {
        question: 'What does the monitoring period involve, and how long will it be?',
        listen_for: 'For many toxins, 4–8 hours of monitoring is appropriate. For others (xylitol, rat poison), 24–48 hours or more is needed. Ask for the specific protocol for the substance ingested.',
        why_it_matters: 'Monitoring time directly drives the total cost of treatment. Understanding what\'s medically necessary for the specific toxin helps you ask informed questions.',
      },
      {
        question: 'If organ damage occurs, what does ongoing treatment look like and cost?',
        listen_for: 'For hepatotoxic substances (xylitol, acetaminophen), ongoing treatment can include days of IV fluids and monitoring plus blood draws.',
        why_it_matters: 'Some toxin cases resolve quickly; others (grape/raisin toxicity in dogs, NSAIDs in cats) can lead to multi-day hospitalizations costing $2,000–$5,000.',
      },
    ],
    sort_order: 30,
    is_active: true,
  },

  // SKIN, EAR & EYE
  {
    id: '31',
    slug: 'ear-infection-treatment',
    display_name: 'Ear Infection Treatment',
    clinical_name: 'Otitis Externa — Exam + Medication',
    category: 'skin_ear_eye',
    species: 'both',
    description_plain:
      'Diagnosis and treatment of an outer ear infection (otitis externa), one of the most common reasons dogs visit the vet. The vet will examine the ear canal with an otoscope, take a cytology sample to identify the organism (yeast vs. bacteria), clean the ear, and prescribe medication. Chronic or recurring ear infections often signal an underlying allergy that requires a separate workup.',
    questions_to_ask: [
      {
        question: 'Is a cytology (ear swab and microscope exam) included, or does that cost extra?',
        listen_for: 'Cytology should always be included in ear infection diagnosis — it\'s the only way to confirm yeast vs. bacteria vs. mixed infection and choose the right medication.',
        why_it_matters: 'Treating a yeast infection with antibiotics (or vice versa) is ineffective and can worsen the condition. Cytology costs $20–$50 and prevents the wrong treatment.',
      },
      {
        question: 'Are the exam fee and medication included in this quote?',
        listen_for: 'Ear medication is often billed separately from the exam and can add $30–$100. Ask if medication is included or how much it will cost.',
        why_it_matters: 'Ear infection visits often surprise pet owners because the medication doubles or triples the stated visit price. Getting the full cost upfront prevents this.',
      },
      {
        question: 'Is this a yeast or bacterial infection — does that change the treatment or cost?',
        listen_for: 'The vet should identify the organism on cytology and match the medication to it. Generic "ear drops that treat everything" are less effective and sometimes more expensive.',
        why_it_matters: 'Correctly targeted treatment resolves the infection faster, reducing total visits and medication costs.',
      },
      {
        question: "If this keeps recurring, what's the workup for underlying allergies?",
        listen_for: 'Recurring ear infections almost always indicate underlying allergies. A vet who just keeps treating the ear without addressing the root cause is creating a cycle of dependency.',
        why_it_matters: 'Allergy workup and management is more expensive upfront ($300–$800+) but breaks the cycle of repeated $100–$250 ear infection visits.',
      },
      {
        question: 'Is an ear flush done at the appointment today?',
        listen_for: 'For significant buildup, an in-clinic flush is sometimes recommended before applying medication. This is an add-on cost ($30–$75) that should be disclosed upfront.',
        why_it_matters: 'Medication doesn\'t penetrate properly through heavy debris. An ear flush is sometimes medically necessary — but knowing the cost before it happens matters.',
      },
    ],
    sort_order: 31,
    is_active: true,
  },
  {
    id: '32',
    slug: 'skin-allergy-workup',
    display_name: 'Skin Allergy Workup',
    clinical_name: 'Atopy Testing / Cytodiagnosis',
    category: 'skin_ear_eye',
    species: 'both',
    description_plain:
      'A diagnostic evaluation for chronic itching, skin infections, or recurring ear infections suspected to be caused by environmental allergies (atopy) or food allergies. The workup typically includes skin cytology and may involve a blood test or intradermal skin test to identify specific allergens. Complete allergy testing is most often referred to a veterinary dermatologist.',
    questions_to_ask: [
      {
        question: 'Is this a blood (serum) allergy test or an intradermal skin test — which is more accurate?',
        listen_for: 'Intradermal testing (done by a veterinary dermatologist) is considered more accurate than serum testing for environmental allergies. Serum testing is more widely available but has more false positives.',
        why_it_matters: 'Choosing the right test upfront avoids paying for a less accurate test and then paying again for the accurate one. A dermatologist referral is often the right first step.',
      },
      {
        question: 'Does this visit include a dermatology referral, or is this a general practice workup?',
        listen_for: 'A clear answer about scope. General practice allergy workups are appropriate for straightforward cases; board-certified dermatologists are better for chronic or complex cases.',
        why_it_matters: 'A dermatologist visit may cost more upfront but often resolves cases faster and with better outcomes than repeated general practice visits.',
      },
      {
        question: 'Is cytology included in the quoted price?',
        listen_for: 'Skin cytology (looking at cells under a microscope) should be included in any allergy workup — it identifies secondary infections that need treatment regardless of the allergy cause.',
        why_it_matters: 'Many itchy pets have both an underlying allergy AND a secondary bacterial or yeast skin infection. Treating only one without the other leaves the condition half-managed.',
      },
      {
        question: 'If allergies are confirmed, what are the treatment options and monthly costs (immunotherapy, Apoquel, Cytopoint)?',
        listen_for: 'An honest menu of options with costs — Apoquel ($50–$80/month), Cytopoint ($80–$120 per injection every 4–8 weeks), and immunotherapy ($100–$200/month).',
        why_it_matters: 'Allergy management is a long-term, monthly cost commitment. Understanding the options before testing lets you plan for a sustainable approach.',
      },
      {
        question: 'Is a food trial recommended before allergy testing?',
        listen_for: 'Yes — food allergies account for ~20% of itchy dogs and ~30% of itchy cats, and are only diagnosable via a strict 8–12 week dietary elimination trial. Food allergy serum testing is largely unreliable.',
        why_it_matters: 'A food trial costs $50–$80/month in prescription food with no testing fees — cheaper than serum allergy testing if food is the cause.',
      },
    ],
    sort_order: 32,
    is_active: true,
  },
  {
    id: '33',
    slug: 'skin-scraping-culture',
    display_name: 'Skin Scraping / Culture',
    clinical_name: 'Dermatophyte / Mange Test',
    category: 'skin_ear_eye',
    species: 'both',
    description_plain:
      'A diagnostic skin test to identify parasitic mange mites (sarcoptic or demodectic) or fungal ringworm infections. A skin scraping involves gently scraping the skin surface and examining cells under a microscope; a fungal culture (DTM test) grows the sample to detect ringworm. These tests are key for diagnosing hair loss, scaly skin, and intense itching that doesn\'t respond to standard treatment.',
    questions_to_ask: [
      {
        question: 'Is the scraping done in-house, or is the sample sent to a lab?',
        listen_for: 'Mange scrapes are examined in-house immediately (results in minutes). Fungal cultures (DTM) grow over 10–14 days and can be done in-house or sent out.',
        why_it_matters: 'Knowing the timeline for results helps you plan for treatment decisions and recheck appointments.',
      },
      {
        question: 'How long does a fungal culture take to grow?',
        listen_for: '10–14 days for a positive result; up to 21 days to rule out ringworm definitively.',
        why_it_matters: 'Ringworm is highly contagious to other pets and humans. Knowing the diagnostic timeline helps you manage home quarantine and exposure risk appropriately.',
      },
      {
        question: 'If mange is found, what does treatment involve and how long does it take?',
        listen_for: 'Demodex mange is treated with isoxazoline class medications for 2–3 months. Sarcoptic mange is treated similarly, and all household pets should be treated.',
        why_it_matters: 'Mange treatment is straightforward when caught early. Knowing the protocol upfront prevents escalation to secondary skin infections that require more expensive care.',
      },
      {
        question: 'Is ringworm contagious to humans — what precautions should we take at home?',
        listen_for: 'Yes, ringworm (dermatophytosis) is a zoonosis — it spreads from animals to humans easily. Environmental decontamination is needed. A good vet will address this proactively.',
        why_it_matters: 'Human family members (especially children and immunocompromised individuals) are at real risk. Understanding zoonotic risk and home decontamination is part of the treatment plan.',
      },
    ],
    sort_order: 33,
    is_active: true,
  },
  {
    id: '34',
    slug: 'eye-pressure-test',
    display_name: 'Eye Pressure Test',
    clinical_name: 'Tonometry — Glaucoma Screen',
    category: 'skin_ear_eye',
    species: 'both',
    description_plain:
      'A quick, painless test that measures intraocular pressure (IOP) in your pet\'s eyes using a handheld tonometer. Elevated pressure indicates glaucoma, which is extremely painful and can cause permanent blindness if not treated promptly. Breeds like Basset Hounds, Cocker Spaniels, and Siberian Huskies are genetically predisposed and benefit from annual screening after age 5.',
    questions_to_ask: [
      {
        question: 'Does the quoted price include both eyes?',
        listen_for: 'Tonometry should always include both eyes — comparing pressures between eyes is diagnostically important.',
        why_it_matters: 'Asymmetric eye pressures (one normal, one high) is an early glaucoma sign. Testing both eyes is the only way to detect this pattern.',
      },
      {
        question: 'Is topical anesthetic used to make this comfortable?',
        listen_for: 'Yes — a drop of proparacaine or similar anesthetic should be used before tonometry. If it\'s not offered, ask for it.',
        why_it_matters: 'Topical anesthetic makes the test more comfortable and reduces blinking that can make readings inaccurate.',
      },
      {
        question: "What's a normal IOP range, and what number would concern you?",
        listen_for: 'Normal canine/feline IOP is 10–25 mmHg. Pressures above 30 mmHg are concerning; above 40 mmHg is an emergency requiring immediate treatment.',
        why_it_matters: 'Knowing the normal range lets you interpret your pet\'s specific result meaningfully, rather than receiving a number with no context.',
      },
      {
        question: "If pressure is elevated, what's the next step — referral to an ophthalmologist?",
        listen_for: 'Yes — glaucoma management in dogs and cats benefits from board-certified ophthalmologist (DACVO) involvement. Medication selection and monitoring require specialist expertise.',
        why_it_matters: 'Untreated glaucoma causes permanent blindness and is extremely painful. Knowing the referral pathway in advance speeds the response to an abnormal result.',
      },
      {
        question: 'Should this be done annually for my breed?',
        listen_for: 'Yes for at-risk breeds (Basset Hound, Cocker Spaniel, Chow Chow, Siberian Husky). Screening from age 5–6 can detect early glaucoma before vision loss occurs.',
        why_it_matters: 'Annual tonometry for at-risk breeds is a modest cost ($30–$60) that can prevent or delay blindness through early detection.',
      },
    ],
    sort_order: 34,
    is_active: true,
  },
  {
    id: '35',
    slug: 'cherry-eye-repair',
    display_name: 'Cherry Eye Repair',
    clinical_name: 'Third Eyelid Prolapse Surgery',
    category: 'skin_ear_eye',
    species: 'dog',
    description_plain:
      'Surgery to reposition the prolapsed tear gland of the third eyelid, which pops out and appears as a red cherry-like mass in the inner corner of the eye. Cherry eye is most common in brachycephalic breeds like Bulldogs, Beagles, and Cocker Spaniels. The preferred treatment is surgical repositioning — not removal — to preserve the tear gland, which produces 30–35% of the eye\'s total tear film.',
    questions_to_ask: [
      {
        question: 'Will the gland be repositioned (tucked) or removed? Removal is no longer the recommended approach.',
        listen_for: 'Repositioning (tucking) — not removal — is the current standard of care. Removal of the tear gland is considered inappropriate in modern veterinary ophthalmology.',
        why_it_matters: 'The third eyelid gland produces 30–35% of the eye\'s total tear film. Removing it creates a permanent dry eye (KCS) requiring lifelong eye drop treatment at $30–$80/month.',
      },
      {
        question: 'What is the recurrence rate with the technique you use?',
        listen_for: 'Pocket technique recurrence rates are 5–20%. Ask specifically which technique is used and the surgeon\'s personal recurrence experience.',
        why_it_matters: 'Cherry eye recurrence requires revision surgery at full cost again. Understanding technique and recurrence rates helps you compare surgeons.',
      },
      {
        question: 'Is there a risk to the other eye — should I watch for it?',
        listen_for: 'Yes — if one eye has cherry eye, the other eye has a 30–40% chance of developing it, especially in brachycephalic breeds.',
        why_it_matters: 'Forewarned is financially prepared. If the other eye pops, you can recognize it quickly and seek treatment before it becomes complicated.',
      },
      {
        question: 'Does the price include anesthesia, the procedure, and a follow-up visit?',
        listen_for: 'All three should be in the quote. A standalone "procedure fee" that doesn\'t include anesthesia or follow-up will end up significantly higher.',
        why_it_matters: 'Cherry eye repair quotes range from $500 to $1,200+ depending on what\'s included. An itemized breakdown prevents comparison-shopping errors.',
      },
      {
        question: 'Is this done under full general anesthesia or sedation?',
        listen_for: 'Full general anesthesia is standard — sedation-only is insufficient for fine ocular surgery. If sedation-only is being quoted, ask why.',
        why_it_matters: 'Inadequate anesthesia during delicate eye surgery increases complication risk. General anesthesia is the appropriate standard for this procedure.',
      },
    ],
    sort_order: 35,
    is_active: true,
  },
]

// ---------------------------------------------------------------------------
// METROS
// ---------------------------------------------------------------------------

export const METROS: Metro[] = [
  // Tier 1 — Major High-Cost Markets
  {
    metro_code: 'NYC',
    display_name: 'New York, NY',
    zip_prefixes: ['100', '101', '102', '103', '104', '110', '111', '112', '113', '114', '116'],
    cost_multiplier: 1.45,
    tier: 1,
  },
  {
    metro_code: 'LAX',
    display_name: 'Los Angeles, CA',
    zip_prefixes: ['900', '901', '902', '903', '904', '905', '906', '907', '908'],
    cost_multiplier: 1.25,
    tier: 1,
  },
  {
    metro_code: 'SFO',
    display_name: 'San Francisco / Bay Area, CA',
    zip_prefixes: ['940', '941', '942', '943', '944', '945', '946', '947', '948', '949', '950', '951'],
    cost_multiplier: 1.40,
    tier: 1,
  },
  {
    metro_code: 'BOS',
    display_name: 'Boston, MA',
    zip_prefixes: ['021', '022', '023', '024', '025', '026', '027'],
    cost_multiplier: 1.30,
    tier: 1,
  },
  {
    metro_code: 'SEA',
    display_name: 'Seattle, WA',
    zip_prefixes: ['980', '981', '982', '983', '984', '985'],
    cost_multiplier: 1.30,
    tier: 1,
  },
  {
    metro_code: 'DCA',
    display_name: 'Washington, DC',
    zip_prefixes: ['200', '201', '202', '203', '204', '205', '220', '221', '222', '223', '240', '241'],
    cost_multiplier: 1.25,
    tier: 1,
  },
  {
    metro_code: 'CHI',
    display_name: 'Chicago, IL',
    zip_prefixes: ['600', '601', '602', '603', '604', '605', '606', '607', '608', '609'],
    cost_multiplier: 1.15,
    tier: 1,
  },
  {
    metro_code: 'SAN',
    display_name: 'San Diego, CA',
    zip_prefixes: ['919', '920', '921', '922', '923'],
    cost_multiplier: 1.20,
    tier: 1,
  },
  {
    metro_code: 'MIA',
    display_name: 'Miami, FL',
    zip_prefixes: ['330', '331', '332', '333', '334', '335'],
    cost_multiplier: 1.10,
    tier: 1,
  },
  {
    metro_code: 'DEN',
    display_name: 'Denver, CO',
    zip_prefixes: ['800', '801', '802', '803', '804', '805'],
    cost_multiplier: 1.15,
    tier: 1,
  },

  // Tier 2 — Large Mid-Cost Markets
  {
    metro_code: 'ATL',
    display_name: 'Atlanta, GA',
    zip_prefixes: ['300', '301', '302', '303', '304', '305', '306', '307', '308', '309'],
    cost_multiplier: 1.00,
    tier: 2,
  },
  {
    metro_code: 'DAL',
    display_name: 'Dallas, TX',
    zip_prefixes: ['750', '751', '752', '753', '754', '755', '756', '757', '758', '759'],
    cost_multiplier: 0.95,
    tier: 2,
  },
  {
    metro_code: 'HOU',
    display_name: 'Houston, TX',
    zip_prefixes: ['770', '771', '772', '773', '774', '775', '776', '777'],
    cost_multiplier: 0.95,
    tier: 2,
  },
  {
    metro_code: 'PHX',
    display_name: 'Phoenix, AZ',
    zip_prefixes: ['850', '851', '852', '853', '854', '855'],
    cost_multiplier: 0.95,
    tier: 2,
  },
  {
    metro_code: 'PDX',
    display_name: 'Portland, OR',
    zip_prefixes: ['970', '971', '972', '973', '974', '975'],
    cost_multiplier: 1.05,
    tier: 2,
  },
  {
    metro_code: 'MSP',
    display_name: 'Minneapolis, MN',
    zip_prefixes: ['550', '551', '552', '553', '554', '555', '560', '561', '562', '563'],
    cost_multiplier: 1.00,
    tier: 2,
  },
  {
    metro_code: 'AUS',
    display_name: 'Austin, TX',
    zip_prefixes: ['785', '786', '787', '788'],
    cost_multiplier: 1.00,
    tier: 2,
  },
  {
    metro_code: 'CLT',
    display_name: 'Charlotte, NC',
    zip_prefixes: ['280', '281', '282', '283'],
    cost_multiplier: 0.95,
    tier: 2,
  },
  {
    metro_code: 'BNA',
    display_name: 'Nashville, TN',
    zip_prefixes: ['370', '371', '372', '373', '374'],
    cost_multiplier: 0.95,
    tier: 2,
  },
  {
    metro_code: 'SAT',
    display_name: 'San Antonio, TX',
    zip_prefixes: ['782', '783', '784'],
    cost_multiplier: 0.90,
    tier: 2,
  },
  {
    metro_code: 'SAC',
    display_name: 'Sacramento, CA',
    zip_prefixes: ['956', '957', '958', '959'],
    cost_multiplier: 1.05,
    tier: 2,
  },
  {
    metro_code: 'BAL',
    display_name: 'Baltimore, MD',
    zip_prefixes: ['210', '211', '212', '213', '214'],
    cost_multiplier: 1.05,
    tier: 2,
  },

  // Tier 3 — Secondary / Value Markets
  {
    metro_code: 'CMH',
    display_name: 'Columbus, OH',
    zip_prefixes: ['430', '431', '432', '433'],
    cost_multiplier: 0.85,
    tier: 3,
  },
  {
    metro_code: 'IND',
    display_name: 'Indianapolis, IN',
    zip_prefixes: ['460', '461', '462', '463', '464', '465', '466'],
    cost_multiplier: 0.85,
    tier: 3,
  },
  {
    metro_code: 'MCI',
    display_name: 'Kansas City, MO',
    zip_prefixes: ['640', '641', '642', '643', '644'],
    cost_multiplier: 0.85,
    tier: 3,
  },
  {
    metro_code: 'SDF',
    display_name: 'Louisville, KY',
    zip_prefixes: ['400', '401', '402', '403', '404', '405'],
    cost_multiplier: 0.82,
    tier: 3,
  },
  {
    metro_code: 'MEM',
    display_name: 'Memphis, TN',
    zip_prefixes: ['380', '381', '382', '383'],
    cost_multiplier: 0.82,
    tier: 3,
  },
  {
    metro_code: 'OKC',
    display_name: 'Oklahoma City, OK',
    zip_prefixes: ['730', '731', '732', '733'],
    cost_multiplier: 0.80,
    tier: 3,
  },
  {
    metro_code: 'RDU',
    display_name: 'Raleigh, NC',
    zip_prefixes: ['275', '276', '277', '278', '279'],
    cost_multiplier: 0.90,
    tier: 3,
  },
  {
    metro_code: 'RIC',
    display_name: 'Richmond, VA',
    zip_prefixes: ['232', '233', '234', '235'],
    cost_multiplier: 0.88,
    tier: 3,
  },
  {
    metro_code: 'SLC',
    display_name: 'Salt Lake City, UT',
    zip_prefixes: ['840', '841', '842', '843', '844'],
    cost_multiplier: 0.90,
    tier: 3,
  },
  {
    metro_code: 'TUS',
    display_name: 'Tucson, AZ',
    zip_prefixes: ['856', '857', '858'],
    cost_multiplier: 0.82,
    tier: 3,
  },
]

// ---------------------------------------------------------------------------
// NATIONAL BENCHMARKS
// Prices in whole dollars. Convert to cents (*100) before inserting to DB.
// Source basis: NAPHIA SOI 2025, Pawlicy Research 2024-25, AVMA PFCE data.
// These are starting estimates — refine after launch using submission data.
// ---------------------------------------------------------------------------

export const NATIONAL_BENCHMARKS: NationalBenchmarks = {
  'annual-wellness-exam': {
    dog: { p50: 65, p70: 85, p90: 120 },
    cat: { p50: 60, p70: 80, p90: 115 },
  },
  'core-vaccine-dog': {
    dog: { p50: 90, p70: 120, p90: 165 },
  },
  'core-vaccine-cat': {
    cat: { p50: 75, p70: 100, p90: 140 },
  },
  'heartworm-test': {
    dog: { p50: 35, p70: 50, p90: 70 },
  },
  'fecal-parasite-test': {
    dog: { p50: 30, p70: 45, p90: 65 },
    cat: { p50: 30, p70: 45, p90: 65 },
  },
  'flea-tick-prevention-6mo': {
    dog: { p50: 75, p70: 100, p90: 135 },
    cat: { p50: 65, p70: 85, p90: 115 },
  },
  'dental-cleaning-dog': {
    dog: { p50: 400, p70: 600, p90: 950 },
  },
  'dental-cleaning-cat': {
    cat: { p50: 300, p70: 450, p90: 700 },
  },
  'blood-panel-basic': {
    dog: { p50: 100, p70: 145, p90: 200 },
    cat: { p50: 95, p70: 135, p90: 190 },
  },
  'blood-panel-senior': {
    dog: { p50: 180, p70: 250, p90: 350 },
    cat: { p50: 170, p70: 240, p90: 335 },
  },
  'urinalysis': {
    dog: { p50: 45, p70: 65, p90: 95 },
    cat: { p50: 45, p70: 65, p90: 95 },
  },
  'xray-single': {
    dog: { p50: 150, p70: 210, p90: 300 },
    cat: { p50: 140, p70: 195, p90: 280 },
  },
  'xray-series': {
    dog: { p50: 250, p70: 360, p90: 500 },
    cat: { p50: 230, p70: 330, p90: 475 },
  },
  'ultrasound-abdominal': {
    dog: { p50: 350, p70: 500, p90: 750 },
    cat: { p50: 325, p70: 475, p90: 700 },
  },
  'spay-dog-under-50': {
    dog: { p50: 350, p70: 500, p90: 750 },
  },
  'spay-dog-over-50': {
    dog: { p50: 500, p70: 700, p90: 1050 },
  },
  'neuter-dog-under-50': {
    dog: { p50: 250, p70: 380, p90: 550 },
  },
  'neuter-dog-over-50': {
    dog: { p50: 400, p70: 550, p90: 800 },
  },
  'spay-cat': {
    cat: { p50: 250, p70: 380, p90: 550 },
  },
  'neuter-cat': {
    cat: { p50: 150, p70: 220, p90: 320 },
  },
  'mass-removal-small': {
    dog: { p50: 350, p70: 500, p90: 800 },
    cat: { p50: 300, p70: 450, p90: 725 },
  },
  'tooth-extraction-single': {
    dog: { p50: 150, p70: 250, p90: 400 },
    cat: { p50: 130, p70: 220, p90: 375 },
  },
  'tooth-extraction-multiple': {
    dog: { p50: 500, p70: 750, p90: 1200 },
    cat: { p50: 450, p70: 700, p90: 1100 },
  },
  'foreign-body-removal': {
    dog: { p50: 2500, p70: 3500, p90: 5500 },
    cat: { p50: 2200, p70: 3200, p90: 5000 },
  },
  'cruciate-repair-tplo': {
    dog: { p50: 4000, p70: 5500, p90: 7500 },
  },
  'emergency-exam-stabilization': {
    dog: { p50: 250, p70: 400, p90: 650 },
    cat: { p50: 250, p70: 400, p90: 650 },
  },
  'iv-fluids-per-day': {
    dog: { p50: 150, p70: 225, p90: 375 },
    cat: { p50: 135, p70: 200, p90: 340 },
  },
  'overnight-icu-stay': {
    dog: { p50: 600, p70: 950, p90: 1500 },
    cat: { p50: 550, p70: 875, p90: 1400 },
  },
  'bloat-surgery-gdv': {
    dog: { p50: 5000, p70: 7000, p90: 10000 },
  },
  'toxin-treatment': {
    dog: { p50: 400, p70: 650, p90: 1100 },
    cat: { p50: 375, p70: 600, p90: 1000 },
  },
  'ear-infection-treatment': {
    dog: { p50: 100, p70: 155, p90: 225 },
    cat: { p50: 90, p70: 140, p90: 200 },
  },
  'skin-allergy-workup': {
    dog: { p50: 250, p70: 400, p90: 650 },
    cat: { p50: 225, p70: 375, p90: 600 },
  },
  'skin-scraping-culture': {
    dog: { p50: 80, p70: 120, p90: 185 },
    cat: { p50: 75, p70: 115, p90: 175 },
  },
  'eye-pressure-test': {
    dog: { p50: 60, p70: 90, p90: 135 },
    cat: { p50: 60, p70: 90, p90: 130 },
  },
  'cherry-eye-repair': {
    dog: { p50: 500, p70: 750, p90: 1150 },
  },
}
