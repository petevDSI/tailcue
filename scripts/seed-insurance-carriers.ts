import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CARRIERS = [
  {
    slug: 'trupanion',
    display_name: 'Trupanion',
    deductible_type: 'per_condition',
    exam_fee_covered: false,
    reimbursement_options: [90],
    annual_limit_options: ['unlimited'],
    notes: 'Trupanion uses a per-condition lifetime deductible — you pay it once per condition, then 90% is covered for life. Exam fees are excluded by default.',
    affiliate_url: 'https://trupanion.com',
    active: true,
  },
  {
    slug: 'healthy-paws',
    display_name: 'Healthy Paws',
    deductible_type: 'annual',
    exam_fee_covered: false,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['unlimited'],
    notes: 'No annual or lifetime payout cap. One of the highest customer satisfaction ratings in the industry.',
    affiliate_url: 'https://healthypawspetinsurance.com',
    active: true,
  },
  {
    slug: 'lemonade',
    display_name: 'Lemonade',
    deductible_type: 'annual',
    exam_fee_covered: false,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['5000', '10000', '20000', '50000', '100000'],
    notes: 'App-first experience. No accident waiting period in most states. Up to 50% of claims approved instantly.',
    affiliate_url: 'https://lemonade.com/pet',
    active: true,
  },
  {
    slug: 'embrace',
    display_name: 'Embrace',
    deductible_type: 'annual',
    exam_fee_covered: false,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['5000', '8000', '10000', '15000', '30000', 'unlimited'],
    notes: 'Best for hereditary conditions. Curable pre-existing conditions may be covered after 12 symptom-free months.',
    affiliate_url: 'https://embracepetinsurance.com',
    active: true,
  },
  {
    slug: 'fetch',
    display_name: 'Fetch',
    deductible_type: 'annual',
    exam_fee_covered: true,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['5000', '10000', '15000', 'unlimited'],
    notes: 'Most comprehensive coverage — includes dental illness, behavioral, and holistic treatments. Exam fees covered.',
    affiliate_url: 'https://fetchpet.com',
    active: true,
  },
  {
    slug: 'pets-best',
    display_name: 'Pets Best',
    deductible_type: 'annual',
    exam_fee_covered: false,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['5000', '10000', 'unlimited'],
    notes: 'No maximum age limit for enrollment. Strong unlimited payout option.',
    affiliate_url: 'https://petsbest.com',
    active: true,
  },
  {
    slug: 'spot',
    display_name: 'Spot',
    deductible_type: 'annual',
    exam_fee_covered: false,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['2500', '3000', '4000', '5000', '7000', '10000', 'unlimited'],
    notes: 'Highly customizable — widest range of annual limit options. Good for budget-conscious users.',
    affiliate_url: 'https://spotpetins.com',
    active: true,
  },
  {
    slug: 'aspca',
    display_name: 'ASPCA Pet Health',
    deductible_type: 'annual',
    exam_fee_covered: true,
    reimbursement_options: [70, 80, 90],
    annual_limit_options: ['3000', '5000', '7000', '10000', 'unlimited'],
    notes: '10% multi-pet discount. Exam fees and microchip implantation included. Good for multi-pet households.',
    affiliate_url: 'https://aspcapetinsurance.com',
    active: true,
  },
]

async function main() {
  console.log('Seeding insurance_carriers…')

  const { error } = await supabase
    .from('insurance_carriers')
    .upsert(CARRIERS, { onConflict: 'slug' })

  if (error) {
    console.error('Error seeding carriers:', error.message)
    process.exit(1)
  }

  const { count, error: countError } = await supabase
    .from('insurance_carriers')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('Error counting carriers:', countError.message)
    process.exit(1)
  }

  console.log(`  ${count} carriers in DB`)

  // Print each slug to confirm
  const { data: rows } = await supabase
    .from('insurance_carriers')
    .select('slug, display_name, deductible_type, exam_fee_covered')
    .order('created_at')

  rows?.forEach((r) => {
    console.log(`  ✓ ${r.display_name.padEnd(20)} slug=${r.slug.padEnd(15)} deductible=${r.deductible_type.padEnd(13)} exam_fee=${r.exam_fee_covered}`)
  })

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
