# FRONTEND DEEP AUDIT REPORT

This report details a deep scan of all pages under `src/app/(main)/`. It documents the specific data fetched, available user actions, and whether permission checks are performed before rendering sensitive UI.

### src/app/(main)/anggaran/konsolidasi/page.tsx
- **Data Fetching:** Fetches data from: /api/anggaran/komisi-options, /api/master-data.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handler, handleExportExcel, handleExportPDF.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/anggaran/rancangan/edit/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/anggaran/tahunan/${id}, /api/buku-besar/coa, /api/anggaran/komisi-options, /api/auth/me, /api/master-data.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAdd, handleEditItem, handleAjukanClick, handleSave.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/anggaran/rancangan/new/page.tsx
- **Data Fetching:** Fetches data from: /api/buku-besar/coa, /api/anggaran/komisi-options, /api/auth/me, /api/master-data, /api/anggaran/tahunan.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handler, handleAdd, handleStartEdit, handleEditSave, handleAjukanClick, handleSave.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/anggaran/rancangan/page.tsx
- **Data Fetching:** Fetches data from: /api/anggaran/tahunan/${deleteTarget.id}, /api/auth/me, /api/anggaran/tahunan, /api/anggaran/tahunan/${batalTarget.id}/batalkan.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleDelete, handleBatalkan.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/anggaran/rancangan/review/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/anggaran/tahunan/${id}/review, /api/auth/me, /api/anggaran/tahunan/${id}.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmitReview.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/anggaran/rancangan/view/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/auth/me, /api/anggaran/tahunan/${id}, /api/anggaran/tahunan/${id}/batalkan.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleBatalkan.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/buku-besar/coa/page.tsx
- **Data Fetching:** Fetches data from: /api/auth/me, /api/buku-besar/coa.
- **User Actions:** Available actions include clickable elements (onClick handlers), form submissions (onSubmit handlers), specific actions: handleOpenDrawer, handleEditDrawer, handleToggleActive, handleSubmit.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/buku-besar/gaji/page.tsx
- **Data Fetching:** Does not appear to fetch data directly via `fetch()` (might rely on parent props or static data).
- **User Actions:** No explicit interactive user actions (e.g., onClick, onSubmit) detected in this file.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/buku-besar/jurnal/edit/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/buku-besar/jurnal, /api/kegiatan, /api/options, /api/buku-besar/coa.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmit.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/buku-besar/jurnal/new/page.tsx
- **Data Fetching:** Fetches data from: /api/buku-besar/jurnal, /api/kegiatan, /api/options, /api/buku-besar/coa.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmit.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/buku-besar/jurnal/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan, /api/buku-besar/coa, /api/buku-besar/jurnal, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleCreateNew, handleView, handleEdit, handleDelete, handleReverse.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/buku-besar/realisasi-kegiatan/page.tsx
- **Data Fetching:** Fetches data from: /api/anggaran/komisi-options, /api/laporan/realisasi-kegiatan, /api/master-data.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/family-tree/FlowCanvas.tsx
- **Data Fetching:** Does not appear to fetch data directly via `fetch()` (might rely on parent props or static data).
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/family-tree/page.tsx
- **Data Fetching:** Fetches data from: /api/options, /api/family-tree/${selectedId}.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handler.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/jadwal/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}, /api/kegiatan/registrasi/saya, /api/upload, /api/auth/me, /api/kegiatan/${id}/registrasi.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleBuktiUpload, handleKirimPendaftaran.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/jadwal/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan, /api/master-data.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handler.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/jemaat/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/family-tree/${jemaatId}, /api/members/${jemaatId}, /api/upload, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleInputChange, handleImageChange, handleCheckboxChange, handleDeptCheckboxChange, handlePekerjaanChange, handleAddAnak, handleRemoveAnak, handleAnakChange, handleAddSaudara, handleRemoveSaudara, handleSaudaraChange, handleCreate.
- **Permissions Check:** Checks permissions (jemaat_edit) before showing sensitive UI.

### src/app/(main)/jemaat/new/page.tsx
- **Data Fetching:** Fetches data from: /api/upload, /api/members, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleInputChange, handleImageChange, handleCheckboxChange, handleDeptCheckboxChange, handlePekerjaanChange, handleAddAnak, handleRemoveAnak, handleAnakChange, handleAddSaudara, handleRemoveSaudara, handleSaudaraChange, handleCreate.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/jemaat/page.tsx
- **Data Fetching:** Fetches data from: /api/members/${id}, /api/members, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleToggleStatus.
- **Permissions Check:** Checks permissions (jemaat_edit, jemaat_create) before showing sensitive UI.

### src/app/(main)/kegiatan/[id]/absen/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}/absensi, /api/kegiatan/${id}, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), form submissions (onSubmit handlers), specific actions: handleStartSession, handleStopSession, handleUsherScan.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/absensi-susulan/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}/absensi, /api/kegiatan/${id}, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), form submissions (onSubmit handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/edit/page.tsx
- **Data Fetching:** Fetches data from: /api/upload, /api/kegiatan/${id}, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleClickOutside, handleInputChange, handleImageChange, handleInputChange, handleRadioChange, handleUpdate, handleRecall.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/lpj/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}/lpj/timeline, /api/kegiatan/${id}/lpj, /api/kegiatan/${id}, /api/buku-besar/coa.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAdd, handleSalinSatuItem, handleSalinSemua, handleStartEdit, handleEditSave, handleSave, handleOpenRiwayat.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/lpj/review/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}/lpj, /api/kegiatan/${id}, /api/kegiatan/${id}/lpj/review.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleReview.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/lpj/view/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}/lpj, /api/kegiatan/${id}.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${id}, /api/kegiatan/${id}/pasien, /api/kegiatan/${id}/absensi, /api/upload, /api/anggaran/tahunan, /api/kegiatan/${id}/registrasi, /api/kegiatan/${id}/pelayan, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleInputChange, handler, handleFocus, handleInputChange, handleSimpanPelayan, handleSimpanRegistrasi, handleSimpanPasien, handleActionRegistrasi, handleBannerUpload.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/kiosk-absensi/page.tsx
- **Data Fetching:** Does not appear to fetch data directly via `fetch()` (might rely on parent props or static data).
- **User Actions:** No explicit interactive user actions (e.g., onClick, onSubmit) detected in this file.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/new/page.tsx
- **Data Fetching:** Fetches data from: /api/upload, /api/kegiatan, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleClickOutside, handleInputChange, handleChange, handleInputChange, handleImageChange, handleRadioChange, handleCreate.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan, /api/kegiatan/${id}, /api/options${query}, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleUpdateStatus, handleDeleteDraft.
- **Permissions Check:** Checks permissions (kegiatan_lpj, kegiatan_absensi, kegiatan_create, kegiatan_manage) before showing sensitive UI.

### src/app/(main)/kegiatan/pastoral/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/pastoral/${ticketId}/status, /api/kegiatan/pastoral/pic-options, /api/kegiatan/pastoral/${ticketId}, /api/kegiatan/pastoral/${ticketId}/assign.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAssign, handleStatusChange.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/pastoral/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/pastoral, /api/kegiatan/pastoral/pic-options, /api/options, /api/kegiatan/pastoral/${selectedTicketId}/assign.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAssign.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/kegiatan/validasi-pembayaran/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/${kegiatanId}/registrasi, /api/kegiatan/validasi-pembayaran.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleVerify.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/layanan-pastoral/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/layanan-pastoral/${id}.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleBatal.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/layanan-pastoral/ajukan/page.tsx
- **Data Fetching:** Fetches data from: /api/layanan-pastoral, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSelectJemaat, handleResetTarget, handleSubmit.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/layanan-pastoral/page.tsx
- **Data Fetching:** Fetches data from: /api/layanan-pastoral/saya.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/layout.tsx
- **Data Fetching:** Fetches data from: /api/auth/me.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleMouseEnterMenu, handleMouseLeaveMenu, handleLogout, handleSwitchRole.
- **Permissions Check:** Checks permissions (jemaat_view, pegawai_approval, user_access_manage, penggajian_manage, buku_besar_manage, kegiatan_create, anggaran_view, kegiatan_pastoral_view, kegiatan_view, anggaran_create, anggaran_review, master_data_manage, pelayan_view, audit_log_view, buku_besar_view, pengurus_view, pegawai_view, kegiatan_manage, akses_sementara_manage) before showing sensitive UI.

### src/app/(main)/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan, /api/kegiatan/${payload.k}/absensi, /api/kegiatan/registrasi/saya, /api/auth/me, /api/pelayan/jadwal-saya.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleOnline, handleOffline, handleScan, handleJadwalPelayananClick.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/pegawai/${pegawaiId}, /api/upload, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleInputChange, handleSearchJemaat, handleUpload, handleUpdate.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/new/page.tsx
- **Data Fetching:** Fetches data from: /api/pegawai, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleInputChange, handleSearchJemaat, handleCreate.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/page.tsx
- **Data Fetching:** Fetches data from: /api/pegawai, /api/auth/me, /api/options, /api/pegawai/${id}.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Checks permissions (pegawai_create, pegawai_edit) before showing sensitive UI.

### src/app/(main)/pegawai/penggajian/[id]/edit/page.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs/${id}/summary.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs/${id}/details, /api/payroll/runs/${runId}/submit, /api/payroll/runs/${id}/summary.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAjukanApproval.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/new/Step1Setup.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs/validate-setup, /api/anggaran/tahunan, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleRaChange, handleChange, handleNext.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/new/Step2Review.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs/${runId}/komponen, /api/payroll/runs/${runId}/details.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSaveAdj.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/new/Step3Final.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs/${runId}/submit, /api/payroll/runs/${runId}/summary.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmit.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/new/page.tsx
- **Data Fetching:** Does not appear to fetch data directly via `fetch()` (might rely on parent props or static data).
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pegawai/penggajian/page.tsx
- **Data Fetching:** Fetches data from: /api/payroll/runs, /api/payroll/runs/${runId}/submit, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAjukanApproval.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pelayan/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/pelayan/${id}, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleInputChange, handleAddRole, handleRemoveRole, handleRoleChange, handleSave.
- **Permissions Check:** Checks permissions (pelayan_manage) before showing sensitive UI.

### src/app/(main)/pelayan/jadwal/page.tsx
- **Data Fetching:** Fetches data from: /api/pelayan/jadwal-saya/konfirmasi, /api/pelayan/jadwal-saya.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleKonfirmasi.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/pelayan/new/page.tsx
- **Data Fetching:** Fetches data from: /api/pelayan, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleInputChange, handleAddRole, handleRemoveRole, handleRoleChange, handleCreate.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/pelayan/page.tsx
- **Data Fetching:** Fetches data from: /api/pelayan, /api/pelayan/${id}, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleToggleStatus.
- **Permissions Check:** Checks permissions (pelayan_manage) before showing sensitive UI.

### src/app/(main)/pengurus/[id]/page.tsx
- **Data Fetching:** Fetches data from: /api/pengurus/${id}/jabatan/${selectedDetailId}, /api/pengurus/${id}/jabatan, /api/auth/me, /api/pengurus/${id}, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAddJabatanSubmit, handleDeactivateClick, handleDeactivateSubmit.
- **Permissions Check:** Checks permissions (pengurus_manage) before showing sensitive UI.

### src/app/(main)/pengurus/new/page.tsx
- **Data Fetching:** Fetches data from: /api/auth/me, /api/options, /api/pengurus.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleAddJabatan, handleRemoveJabatan, handleJabatanChange, handleCreate.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/pengurus/page.tsx
- **Data Fetching:** Fetches data from: /api/settings/akun-akses/users, /api/pengurus/${id}, /api/auth/me, /api/settings/akun-akses/roles, /api/options, /api/pengurus.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleToggleStatus, handleBuatAkun, handleUpdatePassword, handleToggleAkunStatus.
- **Permissions Check:** Checks permissions (pengurus_manage) before showing sensitive UI.

### src/app/(main)/profil/page.tsx
- **Data Fetching:** Fetches data from: /api/family-tree/${profile.id}, /api/members/${authData.jemaat_id}, /api/auth/me, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/riwayat-kehadiran/page.tsx
- **Data Fetching:** Fetches data from: /api/riwayat-kehadiran.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/settings/akun-akses/page.tsx
- **Data Fetching:** Fetches data from: /api/settings/akun-akses/bulk-generate, /api/settings/akun-akses/users, /api/auth/me, /api/settings/akun-akses/roles, /api/settings/akun-akses/users/temp-access, /api/options.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleClickOutside, handleEditRoleAccess, handleSelectAllBulk, handleToggleBulkItem, handleBulkGenerate, handleCreateUser, handleUpdateUser, handleToggleStatus, handleCreateTempAccess.
- **Permissions Check:** Checks caller role or super admin status before rendering sensitive UI.

### src/app/(main)/settings/audit-log/page.tsx
- **Data Fetching:** Fetches data from: /api/audit-log.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/settings/master-data/MasterKomponenGaji.tsx
- **Data Fetching:** Fetches data from: /api/settings/payroll-templates/${template.id}, /api/settings/payroll-templates, /api/settings/payroll-global, /api/master-data, /api/settings/payroll-components, /api/settings/payroll-components/${item.id}.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmit, handleSave, handleSave.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/settings/master-data/page.tsx
- **Data Fetching:** Fetches data from: /api/master-data.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleSubmit, handleToggleRequest, handleEditRequest.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/settings/organisasi/page.tsx
- **Data Fetching:** Fetches data from: /api/settings/organisasi, /api/settings/organisasi/rayon, /api/settings/organisasi/kelompok-sel, /api/pengurus.
- **User Actions:** Available actions include clickable elements (onClick handlers), specific actions: handleTabChange.
- **Permissions Check:** Does not check caller permissions before rendering.

### src/app/(main)/tiket/page.tsx
- **Data Fetching:** Fetches data from: /api/kegiatan/registrasi/saya.
- **User Actions:** Available actions include clickable elements (onClick handlers).
- **Permissions Check:** Does not check caller permissions before rendering.
