// Supabase connection — this is how the dashboard talks to the cloud database
// These keys are safe to have in frontend code (they're designed for it)
// The actual security comes from Row Level Security rules on the database

const SUPABASE_URL = 'https://dtpcwammbcxdmhygwsth.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cGN3YW1tYmN4ZG1oeWd3c3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDQ5ODMsImV4cCI6MjA4NzM4MDk4M30.Jf-D369f7JtPvWSc4dt03mGYx8PE67ovzj-EyCc9uNc';

// Create the Supabase client — this is our connection to the database
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
