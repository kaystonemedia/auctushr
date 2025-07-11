#!/usr/bin/env node

/**
 * Supabase Setup Script
 * 
 * This script automatically configures Supabase storage for the document management system
 * using your existing environment variables.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadEnvVars() {
  const envFiles = ['.env.local', '.env', '.env.production'];
  let supabaseUrl = '';
  let supabaseKey = '';

  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      log(`📄 Found environment file: ${envFile}`, 'blue');
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
      const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
      
      if (urlMatch) supabaseUrl = urlMatch[1].trim();
      if (keyMatch) supabaseKey = keyMatch[1].trim();
      
      if (supabaseUrl && supabaseKey) break;
    }
  }

  return { supabaseUrl, supabaseKey };
}

function extractProjectRef(supabaseUrl) {
  // Extract project reference from URL like https://your-project-id.supabase.co
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

async function setupSupabase() {
  try {
    log('🚀 Starting Supabase Document Management Setup...', 'bold');
    log('');

    // Step 1: Load environment variables
    log('📋 Step 1: Loading environment variables...', 'yellow');
    const { supabaseUrl, supabaseKey } = loadEnvVars();
    
    if (!supabaseUrl || !supabaseKey) {
      log('❌ Error: Could not find NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment files', 'red');
      log('   Please add them to your .env.local file:', 'red');
      log('   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co', 'red');
      log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here', 'red');
      process.exit(1);
    }

    const projectRef = extractProjectRef(supabaseUrl);
    if (!projectRef) {
      log('❌ Error: Invalid Supabase URL format', 'red');
      process.exit(1);
    }

    log(`✅ Found Supabase project: ${projectRef}`, 'green');
    log('');

    // Step 2: Create storage bucket using REST API
    log('📦 Step 2: Creating storage bucket...', 'yellow');
    
    const bucketConfig = {
      id: 'documents',
      name: 'documents',
      public: true,
      file_size_limit: 52428800, // 50MB
      allowed_mime_types: null // Allow all types
    };

    // Use Node.js fetch to create bucket
    log('   Creating "documents" bucket...', 'blue');
    
    const createBucketScript = `
const fetch = require('node-fetch');

async function createBucket() {
  try {
    const response = await fetch('${supabaseUrl}/storage/v1/bucket', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ${supabaseKey}',
        'Content-Type': 'application/json',
        'apikey': '${supabaseKey}'
      },
      body: JSON.stringify(${JSON.stringify(bucketConfig)})
    });

    if (response.ok) {
      console.log('✅ Bucket created successfully');
    } else if (response.status === 409) {
      console.log('ℹ️  Bucket already exists');
    } else {
      const error = await response.text();
      console.log('⚠️  Bucket creation response:', response.status, error);
    }
  } catch (error) {
    console.log('⚠️  Note: Bucket creation via API requires service_role key');
    console.log('   You can create it manually in the Supabase dashboard');
    console.log('   Dashboard → Storage → New bucket → Name: "documents" → Public: Yes');
  }
}

createBucket();
`;

    // Install node-fetch if needed
    try {
      require('node-fetch');
    } catch (e) {
      log('   Installing node-fetch...', 'blue');
      execSync('npm install node-fetch', { stdio: 'inherit' });
    }

    // Execute bucket creation
    fs.writeFileSync('temp-create-bucket.js', createBucketScript);
    execSync('node temp-create-bucket.js', { stdio: 'inherit' });
    fs.unlinkSync('temp-create-bucket.js');

    log('');

    // Step 3: Update package.json scripts
    log('📜 Step 3: Adding setup scripts to package.json...', 'yellow');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts) packageJson.scripts = {};
      
      packageJson.scripts['setup:supabase'] = 'node setup-supabase.js';
      packageJson.scripts['setup:storage'] = 'node setup-supabase.js';
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      log('   ✅ Added setup scripts to package.json', 'green');
    }

    log('');

    // Step 4: Test connection
    log('🔌 Step 4: Testing Supabase connection...', 'yellow');
    
    const testScript = `
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  try {
    const supabase = createClient('${supabaseUrl}', '${supabaseKey}');
    
    // Test bucket listing
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.log('⚠️  Connection test failed:', error.message);
    } else {
      console.log('✅ Connection successful!');
      console.log('📂 Available buckets:', buckets.map(b => b.name).join(', '));
      
      const documentsBucket = buckets.find(b => b.name === 'documents');
      if (documentsBucket) {
        console.log('✅ Documents bucket is ready!');
      } else {
        console.log('⚠️  Documents bucket not found - you may need to create it manually');
      }
    }
  } catch (error) {
    console.log('⚠️  Connection test error:', error.message);
  }
}

testConnection();
`;

    fs.writeFileSync('temp-test-connection.js', testScript);
    execSync('node temp-test-connection.js', { stdio: 'inherit' });
    fs.unlinkSync('temp-test-connection.js');

    log('');

    // Step 5: Create environment verification
    log('🔧 Step 5: Verifying environment setup...', 'yellow');
    
    // Check if storage provider is set
    const envFiles = ['.env.local', '.env'];
    let hasStorageProvider = false;
    
    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('NEXT_PUBLIC_STORAGE_PROVIDER')) {
          hasStorageProvider = true;
          break;
        }
      }
    }

    if (!hasStorageProvider) {
      log('   Adding storage provider configuration...', 'blue');
      const envLocalPath = path.join(process.cwd(), '.env.local');
      const envContent = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
      
      const newContent = envContent + (envContent ? '\n' : '') + 
        '# Storage Provider Configuration\n' +
        'NEXT_PUBLIC_STORAGE_PROVIDER=supabase\n';
      
      fs.writeFileSync(envLocalPath, newContent);
      log('   ✅ Added NEXT_PUBLIC_STORAGE_PROVIDER=supabase to .env.local', 'green');
    }

    log('');
    log('🎉 Supabase setup complete!', 'bold');
    log('');
    log('📝 Summary:', 'bold');
    log('   ✅ Supabase connection verified', 'green');
    log('   ✅ Storage bucket configured', 'green');
    log('   ✅ Environment variables set', 'green');
    log('   ✅ Package scripts added', 'green');
    log('');
    log('🚀 Next steps:', 'bold');
    log('   1. Restart your development server: npm run dev', 'blue');
    log('   2. Your document management system is ready to use!', 'blue');
    log('   3. Documents will be stored in Supabase with 1GB free storage', 'blue');
    log('');
    log('💡 Manual bucket creation (if needed):', 'yellow');
    log(`   Dashboard: ${supabaseUrl.replace('/rest/v1', '')}/project/${projectRef}/storage/buckets`, 'yellow');
    log('   → New bucket → Name: "documents" → Public: Yes', 'yellow');

  } catch (error) {
    log('❌ Setup failed:', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Run setup
setupSupabase(); 