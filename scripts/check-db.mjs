import dotenv from 'dotenv';
dotenv.config();
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL prefix:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) : 'N/A');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
