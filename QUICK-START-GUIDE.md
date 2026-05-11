# Partner Allocations - Quick Start Guide

## Overview
Partner Allocations allows business owners to grant controlled access to their businesses for partner consultants and accountants.

## For Business Owners

### 1. Generate Allocation Code
1. Navigate to `/allocations` in your dashboard
2. Select the business you want to share
3. Choose access rights:
   - **View Only** - Partner can only view data
   - **Create & View** - Partner can create and view records
   - **Manage** - Partner can create, edit, and manage records
4. Click "Generate Code"
5. Share the generated code or link with your partner

### 2. Manage Allocations
- View all active and revoked allocations
- See which partners have access to which businesses
- Revoke access at any time with one click

### 3. Revoke Access
1. Go to `/allocations`
2. Find the allocation you want to revoke
3. Click the trash icon
4. Confirm revocation
5. Partner loses access immediately

## For Partners/Consultants

### 1. Register as Partner
1. Go to registration page
2. Select "Partner/Accountant/Consultant" as user type
3. Complete registration

### 2. Claim Business Access
1. Navigate to `/partner` → Allocations tab
2. Enter the allocation code provided by your client
3. Click "Claim Access"
4. The business will appear in your business list

### 3. Access Allocated Businesses
1. Use the business switcher in the sidebar
2. Select the allocated business (marked with "Allocated" badge)
3. Work within the business according to your assigned rights
4. Switch back to your own businesses anytime

## Access Rights Explained

### View Only
- View all records and reports
- Cannot create, edit, or delete anything
- Read-only access to all modules

### Create & View
- Everything in View Only
- Create new records (sales, expenses, bills, etc.)
- Cannot edit or delete existing records

### Manage
- Everything in Create & View
- Edit existing records
- Delete records (where system policy allows)
- Full management capabilities

## Technical Details

### API Endpoints

**Owner Operations:**
```typescript
// Generate allocation code
trpc.partner.generateInvite.mutate({
  businessId: number,
  rightsProfile: 'view_only' | 'create_view' | 'manage'
})

// List allocations
trpc.partner.listOwnerAllocations.useQuery()

// Revoke allocation
trpc.partner.revoke.mutate({ allocationId: number })
```

**Partner Operations:**
```typescript
// Claim allocation
trpc.partner.claimInvite.mutate({ code: string })

// List allocated businesses
trpc.partner.listPartnerAllocations.useQuery()
```

### Database Schema

**allocation_invites**
- One-time use codes
- Expires after claim
- Can be revoked before claim

**partner_allocations**
- Active allocation records
- Links partner to business
- Stores rights profile
- Can be revoked by owner

**users.userType**
- `standard` - Regular business owner
- `partner` - Consultant/accountant

## Security Features

- ✅ One-time use codes (cannot be reused)
- ✅ Owner-only code generation
- ✅ Partner-only code claiming
- ✅ Instant revocation
- ✅ Audit logging on all operations
- ✅ CSRF protection
- ✅ Rate limiting

## Troubleshooting

### "Allocation code not found"
- Code may have been used already
- Code may have been revoked
- Check for typos in the code

### "Cannot claim invite from same account"
- You cannot allocate a business to yourself
- Use a different partner account

### "You do not have access to this business"
- Allocation may have been revoked
- Check with the business owner
- Verify you're logged into the correct partner account

### Business not appearing in switcher
- Refresh the page
- Check allocation status in Allocations tab
- Verify allocation is "Active" not "Revoked"

## Best Practices

### For Owners
1. Only generate codes for trusted partners
2. Use appropriate rights levels (start with View Only)
3. Review allocations regularly
4. Revoke access when engagement ends
5. Keep allocation codes confidential

### For Partners
1. Keep allocation codes secure
2. Don't share codes with others
3. Respect the access rights granted
4. Communicate with clients about needed permissions
5. Switch to correct business before working

## Support

For issues or questions:
1. Check this guide first
2. Review the verification report
3. Check audit logs for allocation events
4. Contact system administrator

## Future Enhancements

Coming in Phase 2:
- Email notifications on allocation/revocation
- Time-limited allocations (expiry dates)
- Bulk allocation management
- Custom permission matrices
- Allocation analytics and usage tracking
- Demo account allocation model

---

**Version:** 1.0 (Phase 1)  
**Last Updated:** May 11, 2026
