# Rice Trading ERP Pro

একটি সম্পূর্ণ প্রোডাকশন-রেডি রাইস ট্রেডিং ব্যবসা ব্যবস্থাপনা সিস্টেম, বাংলাদেশের রাইস ট্রেডিং কোম্পানিগুলোর জন্য তৈরি।

## বৈশিষ্ট্য

- **Dashboard** — লাইভ পরিসংখ্যান, চার্ট, ট্রেন্ড বিশ্লেষণ
- **Farmer / Buyer Management** — সম্পূর্ণ প্রোফাইল, বকেয়া ট্র্যাকিং, পেমেন্ট হিস্টোরি
- **Purchase / Sales** — সঠিক মূল্য হিসাব, স্বয়ংক্রিয় লাভ-ক্ষতি ক্যালকুলেশন
- **Warehouse & Inventory** — মাল্টি-ওয়্যারহাউস স্টক ট্র্যাকিং, ড্যামেজড স্টক ব্যবস্থাপনা
- **Expense & Cash Management** — খরচ ট্র্যাকিং, ক্যাশ অ্যাডজাস্টমেন্ট
- **Reports** — Purchase/Sales/Expense/Profit & Loss/Cost Analysis
- **Analytics** — জাত-ভিত্তিক বিশ্লেষণ, সেরা কৃষক/ক্রেতা/গ্রাম/জাত
- **Role-based Access** — Admin/Manager/Staff/Viewer

## প্রযুক্তি স্ট্যাক

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Charts:** Chart.js
- **Hosting:** Vercel

## সেটআপ

1. এই রিপো ক্লোন করুন
2. একটি [Supabase](https://supabase.com) প্রজেক্ট তৈরি করুন
3. `js/config.js`-এ আপনার Supabase URL ও Anon Key বসান
4. `sql/` ফোল্ডারের SQL স্ক্রিপ্টগুলো Supabase SQL Editor-এ ক্রমানুসারে রান করুন
5. Vercel-এ ডিপ্লয় করুন (Framework: Other)

## লাইসেন্স

ব্যক্তিগত ব্যবহারের জন্য তৈরি।
