import { useState, type FormEvent, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";

type Document = {
  id: string;
  original_name: string;
  uploaded_at?: string;
};

// Type for temp files with unique ID for deletion
type TempFile = {
  id: string;
  file: File;
  name: string;
  size: number;
};

export function NewClaimPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  const [errType, setErrType] = useState<"error" | "success" | "info">("error");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingTempFileId, setDeletingTempFileId] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tempFiles, setTempFiles] = useState<TempFile[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [formData, setFormData] = useState({
    policy_number: "",
    incident_date: "",
    incident_description: "",
    claimed_amount: "",
    currency: "HKD"
  });

  // Refs for form fields
  const policyInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents when claim is created
  useEffect(() => {
    if (claimId) {
      loadDocuments();
      // Upload any temp files after claim is created
      if (tempFiles.length > 0) {
        uploadTempFiles();
      }
    }
  }, [claimId]);

  async function loadDocuments() {
    if (!claimId) return;
    try {
      const response = await api<{ documents: Document[] }>(`/claims/${claimId}`);
      setDocuments(response.documents || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
    }
  }

  async function uploadTempFiles() {
    if (!claimId || tempFiles.length === 0) return;
    
    for (const tempFile of tempFiles) {
      const fd = new FormData();
      fd.append("file", tempFile.file);
      const token = localStorage.getItem("jw_token");
      
      try {
        await fetch(`/api/claims/${claimId}/documents`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
      } catch (error) {
        console.error("Failed to upload temp file:", error);
      }
    }
    setTempFiles([]);
    await loadDocuments();
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.policy_number.trim()) {
      setErrType("error");
      setErr(t("newClaim.errors.policyRequired"));
      policyInputRef.current?.focus();
      return;
    }
    
    if (!formData.incident_date) {
      setErrType("error");
      setErr(t("newClaim.errors.incidentDateRequired"));
      dateInputRef.current?.focus();
      return;
    }
    
    if (!formData.incident_description.trim()) {
      setErrType("error");
      setErr(t("newClaim.errors.descriptionRequired"));
      descriptionRef.current?.focus();
      return;
    }
    
    if (!formData.claimed_amount || Number(formData.claimed_amount) <= 0) {
      setErrType("error");
      setErr(t("newClaim.errors.amountRequired"));
      amountInputRef.current?.focus();
      return;
    }
    
    setLoading(true);
    setErr(null);
    
    try {
      const body = {
        policy_number: formData.policy_number.trim(),
        incident_date: formData.incident_date,
        incident_description: formData.incident_description.trim(),
        claimed_amount: Number(formData.claimed_amount),
        currency: formData.currency,
      };
      
      const r = await api<{ claim: { id: string } }>("/claims", {
        method: "POST",
        body: JSON.stringify(body),
      });
      
      setClaimId(r.claim.id);
      setErrType("success");
      setErr(t("newClaim.success.draftCreated"));
      setTimeout(() => setErr(null), 3000);
      
    } catch (ex) {
      setErrType("error");
      setErr(ex instanceof Error ? ex.message : t("newClaim.errors.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setSelectedFileName("");
      return;
    }
    
    const file = files[0];
    setSelectedFileName(file.name);
    
    // Validate file size (max 12MB)
    if (file.size > 12 * 1024 * 1024) {
      setErrType("error");
      setErr(t("newClaim.errors.fileTooBig") || "File size exceeds 12MB limit");
      setSelectedFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    if (claimId) {
      // Upload immediately if claim exists
      uploadFileDirectly(file);
    } else {
      // Store temp file for later upload with unique ID
      const newTempFile: TempFile = {
        id: Date.now().toString(),
        file: file,
        name: file.name,
        size: file.size
      };
      setTempFiles(prev => [...prev, newTempFile]);
      setErrType("success");
      setErr(`"${file.name}" ${t("newClaim.success.willUploadAfterCreation") || "will be uploaded after claim creation"}`);
      setTimeout(() => setErr(null), 3000);
      setSelectedFileName("");
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Delete temp file before claim creation
  function deleteTempFile(fileId: string, fileName: string) {
    if (!confirm(t("newClaim.confirmDeleteTemp", { name: fileName }))) {
      return;
    }
    
    setDeletingTempFileId(fileId);
    setTempFiles(prev => prev.filter(f => f.id !== fileId));
    setErrType("success");
    setErr(t("newClaim.success.deleteTempSuccess", { name: fileName }));
    setTimeout(() => setErr(null), 3000);
    setDeletingTempFileId(null);
  }

  async function uploadFileDirectly(file: File) {
    if (!claimId) return;
    
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const token = localStorage.getItem("jw_token");
    
    try {
      const res = await fetch(`/api/claims/${claimId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        setErrType("error");
        setErr(errorText);
        return;
      }
      
      setErrType("success");
      setErr(t("newClaim.success.uploadSuccess"));
      setSelectedFileName("");
      await loadDocuments();
      setTimeout(() => setErr(null), 3000);
    } catch (e) {
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("newClaim.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function deleteDocument(documentId: string, documentName: string) {
    if (!claimId) {
      setErrType("error");
      setErr(t("newClaim.errors.noClaimFound"));
      return;
    }
    
    if (!documentId) {
      setErrType("error");
      setErr(t("newClaim.errors.invalidDocument"));
      return;
    }
    
    if (!confirm(t("newClaim.confirmDelete", { name: documentName }))) {
      return;
    }
    
    setDeletingDocId(documentId);
    const token = localStorage.getItem("jw_token");
    
    try {
      const res = await fetch(`/api/claims/${claimId}/documents/${documentId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) {
        let errorMessage = t("newClaim.errors.deleteFailed");
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = res.statusText || errorMessage;
        }
        setErrType("error");
        setErr(errorMessage);
        return;
      }
      
      setErrType("success");
      setErr(t("newClaim.success.deleteSuccess", { name: documentName }));
      await loadDocuments();
      setTimeout(() => setErr(null), 3000);
    } catch (e) {
      console.error("Delete error:", e);
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("newClaim.errors.deleteFailed"));
    } finally {
      setDeletingDocId(null);
    }
  }

  async function submitClaim() {
    if (!claimId) {
      setErrType("error");
      setErr(t("newClaim.errors.noClaimFound"));
      return;
    }
    
    setLoading(true);
    try {
      await api(`/claims/${claimId}/submit`, { method: "POST", body: "{}" });
      nav(`/claims/${claimId}`);
    } catch (e) {
      setErrType("error");
      setErr(e instanceof Error ? e.message : t("newClaim.errors.submitFailed"));
    } finally {
      setLoading(false);
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get today's date in YYYY-MM-DD format for max date
  const today = new Date().toISOString().split('T')[0];
  
  // Get date 1 year ago for min date
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const minDate = oneYearAgo.toISOString().split('T')[0];

  // Helper function to format currency display
  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      HKD: "HK$",
      USD: "$",
      CNY: "¥",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      SGD: "S$"
    };
    return symbols[currency] || currency;
  };

  // Show pending files message
  const hasPendingFiles = tempFiles.length > 0;

  return (
    <div style={{ 
      padding: "24px", 
      maxWidth: "900px", 
      margin: "0 auto", 
      background: "#f0f2f5", 
      minHeight: "100vh",
      fontFamily: "'Segoe UI', 'Roboto', 'Arial', sans-serif"
    }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link 
          to="/claims" 
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#1976d2",
            textDecoration: "none",
            marginBottom: "20px",
            fontSize: "14px",
            fontWeight: "500",
            transition: "color 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#0d47a1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#1976d2"; }}
        >
          ← {t("newClaim.backToClaims")}
        </Link>
        <h1 style={{ 
          fontSize: "28px", 
          fontWeight: "600", 
          color: "#1a1a1a",
          margin: 0,
          marginBottom: "8px",
          letterSpacing: "-0.5px"
        }}>
          {t("newClaim.title")}
        </h1>
        <p style={{ color: "#5a5a5a", margin: 0, fontSize: "14px" }}>
          {t("newClaim.subtitle")}
        </p>
      </div>

      {/* Pending Files Notification */}
      {hasPendingFiles && !claimId && (
        <div style={{
          background: "#fff8e1",
          borderLeft: "4px solid #ff9800",
          padding: "12px 16px",
          marginBottom: "20px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "12px"
        }}>
          <span style={{ fontSize: "20px" }}>📎</span>
          <span style={{ fontSize: "13px", color: "#e65100" }}>
            {tempFiles.length} {t("newClaim.filesPending") || "file(s) pending. They will be uploaded after you create the claim."}
          </span>
        </div>
      )}

      {/* Error/Success Message */}
      {err && (
        <div style={{
          background: errType === "success" ? "#e8f5e9" : errType === "error" ? "#ffebee" : "#e3f2fd",
          borderLeft: `4px solid ${errType === "success" ? "#4caf50" : errType === "error" ? "#f44336" : "#2196f3"}`,
          padding: "14px 20px",
          marginBottom: "24px",
          borderRadius: "8px",
          color: errType === "success" ? "#2e7d32" : errType === "error" ? "#c62828" : "#0d47a1",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "14px"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {errType === "success" ? "✓" : "⚠️"} {err}
          </span>
          <button 
            onClick={() => setErr(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Draft Claim Banner - Show after claim is created */}
      {claimId && (
        <div style={{
          background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
          borderLeft: "4px solid #667eea",
          padding: "12px 16px",
          marginBottom: "20px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px" }}>📝</span>
            <span style={{ fontSize: "13px", color: "#1a237e", fontWeight: "500" }}>
              {t("newClaim.draftMode") || "Draft Mode - You can still edit and upload documents"}
            </span>
          </div>
          <button
            type="button"
            onClick={submitClaim}
            disabled={loading}
            style={{
              padding: "6px 16px",
              background: loading ? "#ccc" : "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "12px",
              fontWeight: "500",
              transition: "background 0.2s"
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#43a047"; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = "#4caf50"; }}
          >
            {loading ? t("newClaim.submitting") : t("newClaim.submitForReview")}
          </button>
        </div>
      )}

      {/* Form Card */}
      <div style={{
        background: "white",
        borderRadius: "12px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
        border: "1px solid #e8e8e8",
        overflow: "hidden",
        marginBottom: "24px"
      }}>
        <form onSubmit={onSubmit} noValidate>
          {/* Form Header */}
          <div style={{
            padding: "20px 24px",
            background: "#f8f9fa",
            borderBottom: "1px solid #e8e8e8"
          }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1a1a1a" }}>
              {t("newClaim.claimInformation")}
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#666" }}>
              {t("newClaim.requiredFieldsNote")}
            </p>
          </div>

          {/* Form Fields - Disabled after claim creation */}
          <div style={{ padding: "24px" }}>
            {/* Policy Number */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px"
              }}>
                {t("newClaim.policyNumber")} <span style={{ color: "#c62828" }}>*</span>
              </label>
              <input
                ref={policyInputRef}
                type="text"
                value={formData.policy_number}
                onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                required
                placeholder={t("newClaim.policyPlaceholder")}
                autoComplete="off"
                disabled={!!claimId}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#1a1a1a",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                  background: claimId ? "#f5f5f5" : "white"
                }}
                onFocus={(e) => {
                  if (!claimId) {
                    e.currentTarget.style.borderColor = "#667eea";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#ddd";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Incident Date */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px"
              }}>
                {t("newClaim.incidentDate")} <span style={{ color: "#c62828" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={formData.incident_date}
                  onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                  required
                  min={minDate}
                  max={today}
                  disabled={!!claimId}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px",
                    color: "#1a1a1a",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    backgroundColor: claimId ? "#f5f5f5" : "white"
                  }}
                  onFocus={(e) => {
                    if (!claimId) {
                      e.currentTarget.style.borderColor = "#667eea";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#ddd";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <div style={{ 
                  position: "absolute", 
                  right: "12px", 
                  top: "50%", 
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  fontSize: "16px",
                  color: "#999"
                }}>
                  📅
                </div>
              </div>
            </div>

            {/* Incident Description */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "8px"
              }}>
                {t("newClaim.incidentDescription")} <span style={{ color: "#c62828" }}>*</span>
              </label>
              <textarea
                ref={descriptionRef}
                value={formData.incident_description}
                onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
                required
                rows={5}
                disabled={!!claimId}
                placeholder={t("newClaim.descriptionPlaceholder")}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: "#1a1a1a",
                  fontFamily: "inherit",
                  resize: "vertical",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  boxSizing: "border-box",
                  background: claimId ? "#f5f5f5" : "white"
                }}
                onFocus={(e) => {
                  if (!claimId) {
                    e.currentTarget.style.borderColor = "#667eea";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#ddd";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Amount and Currency */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginBottom: "8px"
                }}>
                  {t("newClaim.claimedAmount")} <span style={{ color: "#c62828" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "14px",
                    color: "#666",
                    pointerEvents: "none"
                  }}>
                    {getCurrencySymbol(formData.currency)}
                  </span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={formData.claimed_amount}
                    onChange={(e) => setFormData({ ...formData, claimed_amount: e.target.value })}
                    required
                    disabled={!!claimId}
                    placeholder="0.00"
                    style={{
                      width: "100%",
                      padding: "12px 14px 12px 40px",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      fontSize: "14px",
                      color: "#1a1a1a",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                      boxSizing: "border-box",
                      background: claimId ? "#f5f5f5" : "white"
                    }}
                    onFocus={(e) => {
                      if (!claimId) {
                        e.currentTarget.style.borderColor = "#667eea";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#ddd";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              <div style={{ minWidth: "140px" }}>
                <label style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#1a1a1a",
                  marginBottom: "8px"
                }}>
                  {t("newClaim.currency")} <span style={{ color: "#c62828" }}>*</span>
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  disabled={!!claimId}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    fontSize: "14px",
                    cursor: claimId ? "not-allowed" : "pointer",
                    background: claimId ? "#f5f5f5" : "white",
                    color: "#1a1a1a",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="HKD">🇭🇰 {t("newClaim.currencyHKD")}</option>
                  <option value="USD">🇺🇸 {t("newClaim.currencyUSD")}</option>
                  <option value="CNY">🇨🇳 {t("newClaim.currencyCNY")}</option>
                  <option value="EUR">🇪🇺 {t("newClaim.currencyEUR")}</option>
                  <option value="GBP">🇬🇧 {t("newClaim.currencyGBP")}</option>
                  <option value="JPY">🇯🇵 {t("newClaim.currencyJPY")}</option>
                  <option value="SGD">🇸🇬 {t("newClaim.currencySGD")}</option>
                </select>
              </div>
            </div>

            {/* Pending Temp Files List - Show before claim creation */}
            {tempFiles.length > 0 && !claimId && (
              <div style={{
                marginTop: "16px",
                marginBottom: "16px",
                padding: "12px",
                background: "#fff8e1",
                borderRadius: "8px",
                border: "1px solid #ffe082"
              }}>
                <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "12px", color: "#e65100" }}>
                  📋 {t("newClaim.pendingFiles") || "Pending Files (will be uploaded after claim creation)"}
                </div>
                {tempFiles.map((tempFile) => (
                  <div key={tempFile.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "white",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    border: "1px solid #ffe082"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>📄</span>
                      <div>
                        <div style={{ fontWeight: "500", fontSize: "13px", color: "#1a1a1a" }}>
                          {tempFile.name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          {formatFileSize(tempFile.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTempFile(tempFile.id, tempFile.name)}
                      disabled={deletingTempFileId === tempFile.id}
                      style={{
                        padding: "4px 12px",
                        background: deletingTempFileId === tempFile.id ? "#ccc" : "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: deletingTempFileId === tempFile.id ? "not-allowed" : "pointer",
                        fontSize: "11px",
                        fontWeight: "500",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <span>🗑️</span> {deletingTempFileId === tempFile.id ? "..." : t("newClaim.delete")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Document Upload Section - Custom File Input */}
            <div style={{
              marginTop: "16px",
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #e8e8e8"
            }}>
              <label style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#1a1a1a",
                marginBottom: "12px"
              }}>
                📎 {t("newClaim.supportingDocuments")}
                <span style={{
                  marginLeft: "8px",
                  fontSize: "11px",
                  fontWeight: "normal",
                  color: "#666"
                }}>
                  ({t("newClaim.optionalNote")})
                </span>
              </label>
              
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                {/* Custom file input button */}
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "10px 20px",
                      background: "#1976d2",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
                  >
                    <span>📁</span> {t("newClaim.chooseFile")}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    style={{ display: "none" }}
                  />
                </div>
                
                {/* Show selected filename or "No file chosen" */}
                <span style={{
                  fontSize: "13px",
                  color: selectedFileName ? "#1a1a1a" : "#999",
                  fontStyle: selectedFileName ? "normal" : "italic"
                }}>
                  {selectedFileName || t("newClaim.noFileChosen")}
                </span>
                
                {uploading && (
                  <span style={{ fontSize: "13px", color: "#666", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className="spinner"></span>
                    {t("newClaim.uploading")}
                  </span>
                )}
              </div>
              
              <p style={{
                fontSize: "11px",
                color: "#999",
                marginTop: "8px",
                marginBottom: 0
              }}>
                {t("newClaim.supportedDocsList")}
              </p>
            </div>

            {/* Create Draft Button - Only show before claim creation */}
            {!claimId && (
              <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
                paddingTop: "16px",
                marginTop: "16px",
                borderTop: "1px solid #e8e8e8"
              }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "10px 24px",
                    background: loading ? "#ccc" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="spinner"></span> {t("newClaim.creatingDraft")}
                    </span>
                  ) : (
                    t("newClaim.createDraft")
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Uploaded Documents List Section - Shows AFTER claim is created with DELETE buttons */}
      {claimId && (
        <div style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📄</span> {t("newClaim.uploadedDocuments") || "Uploaded Documents"} ({documents.length})
            </h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "6px 16px",
                background: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#5a6268"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#6c757d"; }}
            >
              <span>📎</span> {t("newClaim.uploadMore") || "Upload More"}
            </button>
          </div>
          
          {documents.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px dashed #ddd"
            }}>
              <span style={{ fontSize: "32px" }}>📄</span>
              <p style={{ marginTop: "12px", color: "#666", fontSize: "13px" }}>
                {t("newClaim.noDocuments")}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  marginTop: "12px",
                  padding: "8px 20px",
                  background: "#1976d2",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "500"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
              >
                📁 {t("newClaim.chooseFile")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {documents.map((doc) => (
                <div key={doc.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#f8f9fa",
                  borderRadius: "8px",
                  border: "1px solid #e8e8e8",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f0f0"; e.currentTarget.style.borderColor = "#1976d2"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f8f9fa"; e.currentTarget.style.borderColor = "#e8e8e8"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <span style={{ fontSize: "24px" }}>📄</span>
                    <div>
                      <div style={{ fontWeight: "500", color: "#1a1a1a", fontSize: "14px" }}>
                        {doc.original_name}
                      </div>
                      {doc.uploaded_at && (
                        <div style={{ fontSize: "11px", color: "#999", marginTop: "2px" }}>
                          {t("newClaim.uploadedOn") || "Uploaded on"}: {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const token = localStorage.getItem("jw_token");
                        const res = await fetch(
                          `/api/claims/${claimId}/documents/${doc.id}/download`,
                          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
                        );
                        if (!res.ok) return;
                        const blob = await res.blob();
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = doc.original_name;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      style={{
                        padding: "6px 14px",
                        background: "#1976d2",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "500",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#1565c0"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#1976d2"; }}
                    >
                      📥 {t("newClaim.download")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id, doc.original_name)}
                      disabled={deletingDocId === doc.id}
                      style={{
                        padding: "6px 14px",
                        background: deletingDocId === doc.id ? "#ccc" : "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: deletingDocId === doc.id ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        fontWeight: "500",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => { 
                        if (deletingDocId !== doc.id) {
                          e.currentTarget.style.background = "#c82333"; 
                        }
                      }}
                      onMouseLeave={(e) => { 
                        if (deletingDocId !== doc.id) {
                          e.currentTarget.style.background = "#dc3545"; 
                        }
                      }}
                    >
                      🗑️ {deletingDocId === doc.id ? t("newClaim.deleting") : t("newClaim.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Information Note */}
      <div style={{
        marginTop: "20px",
        padding: "16px",
        background: "#e3f2fd",
        borderRadius: "8px",
        border: "1px solid #bbdefb",
        fontSize: "12px",
        color: "#0d47a1"
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "16px" }}>ℹ️</span>
          <div>
            <strong>{t("newClaim.importantInfo")}:</strong> 
            <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
              <li>{t("newClaim.infoStep1")}</li>
              <li>{t("newClaim.infoStep2")}</li>
              <li>{t("newClaim.infoStep3")}</li>
              <li>{t("newClaim.infoStep4")}</li>
              <li>{t("newClaim.infoStep5")}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div style={{
        marginTop: "16px",
        padding: "12px 16px",
        background: "#fff8e1",
        borderRadius: "8px",
        border: "1px solid #ffe082",
        fontSize: "12px",
        color: "#e65100"
      }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <span style={{ fontSize: "14px" }}>💡</span>
          <div>
            <strong>{t("newClaim.supportedDocs")}:</strong> {t("newClaim.supportedDocsList")}
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 50%;
          border-top-color: #1976d2;
          animation: spin 0.8s linear infinite;
        }
        
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0;
          position: absolute;
          right: 0;
          width: 100%;
          height: 100%;
        }
        
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}