# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New project"
4. Choose your organization
5. Fill in project details:
   - **Name**: `styletry-documents` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
6. Click "Create new project"

## 2. Set up Storage Bucket

1. In your Supabase dashboard, go to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Fill in bucket details:
   - **Name**: `documents`
   - **Public bucket**: ✅ **Yes** (we'll handle access control in our app)
   - **File size limit**: `50 MB` (adjust as needed)
   - **Allowed MIME types**: Leave empty for all types
4. Click **Create bucket**

## 3. Set up RLS (Row Level Security) Policies

1. In your Supabase dashboard, go to **Authentication** → **Policies**
2. Click on your `documents` bucket
3. Click **New policy**
4. Create these policies:

### Policy 1: Allow authenticated users to upload
```sql
CREATE POLICY "Allow authenticated users to upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');
```

### Policy 2: Allow users to view their own documents
```sql
CREATE POLICY "Allow users to view their own documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Policy 3: Allow users to delete their own documents
```sql
CREATE POLICY "Allow users to delete their own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 4. Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following values:
   - **Project URL** (looks like: `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## 5. Add Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Storage Provider Configuration
NEXT_PUBLIC_STORAGE_PROVIDER=supabase
```

## 6. File Structure in Supabase

Your documents will be organized like this:
```
documents/
├── employee-docs/
│   ├── {employeeId}/
│   │   ├── contracts/
│   │   ├── performance/
│   │   └── personal/
├── company-docs/
│   ├── policies/
│   ├── handbooks/
│   └── forms/
└── templates/
    ├── contracts/
    ├── forms/
    └── letters/
```

## 7. Test Your Setup

After adding the environment variables, restart your development server:

```bash
npm run dev
```

The document upload should now work with Supabase storage.

## 8. Storage Limits

**Free Tier Limits:**
- **Storage**: 1GB
- **Transfer**: 2GB per month
- **Requests**: 50k per month

This is perfect for your demo phase. When you're ready to scale, you can:
1. Upgrade to Supabase Pro ($25/month)
2. Or migrate to Firebase Storage when moving to Blaze plan

## 9. Monitoring Usage

You can monitor your storage usage in:
- **Supabase Dashboard** → **Settings** → **Usage**
- Check file count and storage size
- Monitor transfer bandwidth

## 10. Security Notes

✅ **What we have:**
- Authentication required for all uploads
- Users can only access their own documents
- Firestore handles document metadata and permissions
- File access controlled by our application logic

✅ **Additional security:**
- All file URLs are signed and time-limited
- Document permissions managed in Firestore
- Audit trail for all document actions
- Role-based access control

Your document management system is now ready with Supabase storage! 🚀 