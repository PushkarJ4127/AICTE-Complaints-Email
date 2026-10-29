import React, { useState, useEffect } from 'react';
import { getInstitutions, type Institution } from '../services/supabase/institutions';
import { ingestDirectComplaint, getComplaintByNumberOrId, getComplaintUpdates } from '../services/supabase/complaints';
import { isSupabaseConfigured } from '../services/supabase/client';
import {
  registerCitizen,
  authenticateCitizen,
  check7DaySubmissionRestriction,
  recordGrievanceSubmission,
  getOfficialResponses,
  checkAndApply15DayProofTimeout,
  type RegisteredCitizen,
  type OfficialBureauResponse,
} from '../services/grievanceStorage';
import type { ComplaintWithRelations, ComplaintUpdateWithAuthor, EvidenceItem } from '../types/database.types';
import { EvidenceUploader } from '../components/intake/EvidenceUploader';
import { getOpenComplaintsForInstitution, joinComplaintCluster } from '../services/supabase/clusters';
import { uploadEvidenceFiles } from '../services/supabase/evidenceStorage';
import { findSimilarOpenCases, type SimilarCase } from '../services/clustering/clusterDetector';
import { sendComplaintStatusEmail } from '../services/brevo/email';
import {
  CheckCircle2, AlertCircle, Send, Building2, User, Search, Tag, X,
  ShieldCheck, GraduationCap, Briefcase, LogOut, AlertTriangle, Check,
  Smartphone, FileText, UserPlus, LogIn, Users, Loader2,
} from 'lucide-react';

const COMPLAINT_CATEGORIES = [
  'Fee Cap Violation', 'Non-Refund of Security Deposit', 'Withholding of Original Certificates',
  'Faculty Deficiency & Non-Payment of Remuneration', 'Unauthorized Course Operation',
  'Ragging & Student Harassment', 'Infrastructure & Lab Non-Compliance',
  'Governance & Administrative Malpractice', 'Admission Irregularity',
];

const CATEGORY_BUREAU_MAP: Record<string, string> = {
  'Fee Cap Violation': 'PGRC', 'Non-Refund of Security Deposit': 'PGRC',
  'Withholding of Original Certificates': 'PGRC', 'Faculty Deficiency & Non-Payment of Remuneration': 'RB',
  'Unauthorized Course Operation': 'RB', 'Ragging & Student Harassment': 'PGRC',
  'Infrastructure & Lab Non-Compliance': 'AB', 'Governance & Administrative Malpractice': 'PAP',
  'Admission Irregularity': 'RB',
};

const getIdentityField = (cat: string) => {
  if (cat === 'Faculty') return { label: 'Employee ID', placeholder: 'e.g. EMP-8491' };
  if (cat === 'Institution') return { label: 'Institution ID', placeholder: 'e.g. 1-1000001' };
  if (cat === 'Parent') return null;
  return { label: 'Student Roll / Enrollment No.', placeholder: 'e.g. 2023-CS-042' };
};

const DEFAULT_INSTITUTIONS_FALLBACK: Institution[] = [
  { id: 'inst-001', institution_name: 'Apex Institute of Pharmaceutical Sciences', aicte_permanent_id: '1-7102948210', state: 'Uttar Pradesh', district: null, institution_type: 'Engineering', address: 'Lucknow, UP', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inst-002', institution_name: 'Aryavart Institute of Technical Education', aicte_permanent_id: '1-6291048201', state: 'Rajasthan', district: null, institution_type: 'Engineering', address: 'Jaipur, RJ', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inst-003', institution_name: 'Bhartiya Advanced Institute of Management', aicte_permanent_id: '1-4920194812', state: 'Karnataka', district: null, institution_type: 'Management', address: 'Bengaluru, KA', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inst-004', institution_name: 'College of Engineering Pune (COEP)', aicte_permanent_id: '1-1000001', state: 'Maharashtra', district: null, institution_type: 'Engineering', address: 'Shivajinagar, Pune', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inst-005', institution_name: 'Vidyapeeth College of Engineering', aicte_permanent_id: '1-8930219482', state: 'Tamil Nadu', district: null, institution_type: 'Engineering', address: 'Chennai, TN', created_at: '2026-01-01', updated_at: '2026-01-01' },
  { id: 'inst-006', institution_name: 'National Institute of Technical Studies', aicte_permanent_id: '1-5501928471', state: 'Delhi', district: null, institution_type: 'Engineering', address: 'New Delhi', created_at: '2026-01-01', updated_at: '2026-01-01' },
];

export const PublicGrievancePortal: React.FC<{ onGoToLogin?: () => void }> = () => {
  const [institutions, setInstitutions] = useState<Institution[]>(DEFAULT_INSTITUTIONS_FALLBACK);
  const [showNotice, setShowNotice] = useState(true);
  const [trackingMode, setTrackingMode] = useState(false);
  const [currentCitizen, setCurrentCitizen] = useState<RegisteredCitizen | null>(() => {
    try { const s = sessionStorage.getItem('aicte_public_citizen'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');

  const [regFullName, setRegFullName] = useState('');
  const [regCategory, setRegCategory] = useState<'Student' | 'Faculty' | 'Parent' | 'Institution'>('Student');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRollNo, setRegRollNo] = useState('');
  const [regInstitutionId, setRegInstitutionId] = useState('');
  const [regInstSearch, setRegInstSearch] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [complainantName, setComplainantName] = useState(currentCitizen?.fullName || '');
  const [complainantEmail, setComplainantEmail] = useState(currentCitizen?.email || '');
  const [complainantPhone, setComplainantPhone] = useState(currentCitizen?.phone || '');
  const [complainantType, setComplainantType] = useState(currentCitizen?.category || 'Student');
  const [studentRollNo, setStudentRollNo] = useState(currentCitizen?.rollNo || '');
  const [institutionId, setInstitutionId] = useState(currentCitizen?.institutionId || '');
  const [institutionSearch, setInstitutionSearch] = useState(currentCitizen?.institutionName || '');
  const [showInstitutionResults, setShowInstitutionResults] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState('');
  const [isSearchingTrack, setIsSearchingTrack] = useState(false);
  const [trackedRecord, setTrackedRecord] = useState<ComplaintWithRelations | null>(null);
  const [trackedUpdates, setTrackedUpdates] = useState<ComplaintUpdateWithAuthor[]>([]);
  const [trackedResponses, setTrackedResponses] = useState<OfficialBureauResponse[]>([]);
  const [autoCloseInfo, setAutoCloseInfo] = useState<{ isAutoClosed: boolean; reason: string | null }>({ isAutoClosed: false, reason: null });
  const [trackError, setTrackError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successComplaintNumber, setSuccessComplaintNumber] = useState<string | null>(null);

  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [similarCases, setSimilarCases] = useState<SimilarCase[]>([]);
  const [showSimilarModal, setShowSimilarModal] = useState(false);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);

  useEffect(() => {
    getInstitutions().then(list => list?.length && setInstitutions(list)).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentCitizen) {
      setComplainantName(currentCitizen.fullName);
      setComplainantEmail(currentCitizen.email);
      setComplainantPhone(currentCitizen.phone || '');
      setComplainantType(currentCitizen.category || 'Student');
      setStudentRollNo(currentCitizen.rollNo || '');
      if (!institutionId) {
        setInstitutionId(currentCitizen.institutionId);
        setInstitutionSearch(currentCitizen.institutionName || '');
      }
    }
  }, [currentCitizen]);

  const filterInst = (q: string) => {
    const s = q.trim().toLowerCase();
    return s ? institutions.filter(i => i.institution_name.toLowerCase().includes(s) || (i.aicte_permanent_id || '').toLowerCase().includes(s) || i.state.toLowerCase().includes(s)) : institutions;
  };
  const filteredRegInstitutions = filterInst(regInstSearch);
  const matchingInstitutions = filterInst(institutionSearch);
  const registrationIdentityField = getIdentityField(regCategory);
  const complaintIdentityField = getIdentityField(complainantType);

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    if (!regFullName.trim()) return setRegError('Please provide your full legal name.');
    if (!regEmail.trim() || !regEmail.includes('@') || !regEmail.includes('.')) return setRegError('Please provide a valid official / correspondence email address.');
    if (!regPhone.trim()) return setRegError('Mobile number is compulsory for SMS updates & statutory verification.');
    if (registrationIdentityField && !regRollNo.trim()) return setRegError(`${registrationIdentityField.label} is compulsory.`);
    if (!regInstitutionId) return setRegError('Please select your AICTE-approved institution from the dropdown list.');

    try {
      const selectedInst = institutions.find(i => i.id === regInstitutionId);
      const registered = registerCitizen({
        fullName: regFullName.trim(), category: regCategory, email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(), rollNo: regRollNo.trim(), institutionId: regInstitutionId,
        institutionName: selectedInst?.institution_name || 'AICTE Technical Institution',
        password: regPassword || 'Password@123',
      });
      sessionStorage.setItem('aicte_public_citizen', JSON.stringify(registered));
      setCurrentCitizen(registered);
    } catch (err: unknown) {
      setRegError((err as { message?: string })?.message || 'Failed to complete registration.');
    }
  };

  const handleCitizenLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim()) return setLoginError('Please enter your registered email address.');
    const match = authenticateCitizen(loginEmail.trim());
    if (!match) return setLoginError(`Access Denied: The email "${loginEmail.trim()}" is not registered in the AICTE grievance portal. Only email IDs created during New Registration are accepted for login. Please register first.`);
    sessionStorage.setItem('aicte_public_citizen', JSON.stringify(match));
    setCurrentCitizen(match);
  };

  const handlePreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!declarationChecked) return setErrorMessage('You must accept the Legal Declaration checkbox before submitting.');
    if (!complainantName.trim()) return setErrorMessage('Full Legal Name is compulsory.');
    if (!complainantEmail.trim()) return setErrorMessage('Email address is compulsory.');
    if (!complainantPhone.trim()) return setErrorMessage('Mobile Number (for SMS notifications) is compulsory.');
    if (complaintIdentityField && !studentRollNo.trim()) return setErrorMessage(`${complaintIdentityField.label} is compulsory.`);
    if (!institutionId) return setErrorMessage('Please select an AICTE-approved institution from the search results.');
    if (!title.trim() || !description.trim()) return setErrorMessage('Grievance Title and Chronological Details are required.');

    const limitCheck = check7DaySubmissionRestriction(complainantEmail);
    if (!limitCheck.allowed) {
      return setErrorMessage(`Submission Blocked: A grievance was already registered from "${complainantEmail}" on ${limitCheck.lastSubmittedAt}. Under AICTE Regulations, you cannot register a new grievance until a span of 7 days has elapsed. Next eligible filing date: ${limitCheck.nextEligibleDate} (${limitCheck.daysRemaining} days remaining).`);
    }

    setIsCheckingSimilar(true);
    try {
      const existing = await getOpenComplaintsForInstitution(institutionId);
      const matches = findSimilarOpenCases({ institution_id: institutionId, category, title: title.trim(), description: description.trim(), received_at: new Date().toISOString() }, existing)
        .filter(m => (m.complaint.complainant_email || '').toLowerCase() !== complainantEmail.trim().toLowerCase());
      if (matches.length > 0) {
        setSimilarCases(matches);
        setJoinError(null);
        setShowSimilarModal(true);
        return;
      }
    } catch (err) {
      console.warn('Similar-complaint lookup skipped:', err);
    } finally {
      setIsCheckingSimilar(false);
    }
    setShowConfirmModal(true);
  };

  const prepareEvidence = async (): Promise<EvidenceItem[]> => {
    if (evidenceFiles.length === 0) return evidenceItems;
    const paths = await uploadEvidenceFiles(evidenceFiles);
    return evidenceItems.map(it => {
      const idx = evidenceFiles.findIndex(f => f.name === it.file_name && f.size === it.size);
      return { ...it, storage_path: idx >= 0 ? paths[idx] : null };
    });
  };

  const handleJoinExisting = async (target: SimilarCase) => {
    setJoiningId(target.complaint.id);
    setJoinError(null);
    try {
      const ev = await prepareEvidence();
      const count = await joinComplaintCluster(target.complaint.id, { name: complainantName.trim(), email: complainantEmail.trim(), phone: complainantPhone.trim(), rollNo: studentRollNo.trim() }, description.trim(), ev);
      recordGrievanceSubmission(complainantEmail, target.complaint.complaint_number);
      setJoinedCount(count);
      setShowSimilarModal(false);
      setSuccessComplaintNumber(target.complaint.complaint_number);
    } catch (err: unknown) {
      setJoinError(/already joined/i.test((err as { message?: string })?.message || '') ? 'You have already joined this complaint.' : 'Could not add you to this complaint right now. Please try again, or file your own complaint instead.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    if (!isSupabaseConfigured()) {
      setErrorMessage('Shared backend is not configured.');
      setIsSubmitting(false);
      return;
    }
    try {
      const ev = await prepareEvidence();
      const result = await ingestDirectComplaint({
        institutionId, title: title.trim(), description: description.trim(), category, priority: 'Normal',
        complainantName: complainantName.trim(), complainantEmail: complainantEmail.trim(), complainantPhone: complainantPhone.trim(),
        complainantType, studentRollNo: studentRollNo.trim(), departmentCode: CATEGORY_BUREAU_MAP[category] || 'PGRC',
        originalLanguage: null, originalText: null, evidence: ev,
      });

      try {
        await sendComplaintStatusEmail({
          recipientEmail: complainantEmail.trim(),
          recipientName: complainantName.trim(),
          complaintNumber: result.complaint_number,
          complaintTitle: title.trim(),
          status: 'Registered / Received',
          remarks: `Your grievance has been formally registered in the AICTE Central Repository and auto-routed to the ${CATEGORY_BUREAU_MAP[category] || 'PGRC'} bureau for statutory review. Track progress anytime using Reference ID: ${result.complaint_number}.`,
          officerName: 'Central Intake System',
          officerDesignation: 'Automated Grievance Registrar',
          dispatchType: 'Official Acknowledgement',
          referenceNumber: result.complaint_number,
          institutionName: selectedTargetInstitution?.institution_name || 'AICTE Technical Institution',
        });
      } catch (emailErr) {
        console.warn('Brevo confirmation email dispatch failed:', emailErr);
      }

      recordGrievanceSubmission(complainantEmail, result.complaint_number);
      setShowConfirmModal(false);
      setSuccessComplaintNumber(result.complaint_number);
    } catch (err: unknown) {
      setErrorMessage((err as { message?: string })?.message || 'The grievance could not be saved to the registry.');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackSearch = async () => {
    if (!trackingNumber.trim()) return;
    setIsSearchingTrack(true);
    setTrackError(null);
    setTrackedRecord(null);
    setTrackedUpdates([]);
    setTrackedResponses([]);
    const cleanInput = trackingNumber.trim().toUpperCase().replace(/\s*-\s*/g, '-');

    try {
      const timeoutStatus = checkAndApply15DayProofTimeout(cleanInput);
      setAutoCloseInfo(timeoutStatus);
      const storedResponses = getOfficialResponses(cleanInput);
      setTrackedResponses(storedResponses);

      let res: ComplaintWithRelations | null = null;
      try { res = await getComplaintByNumberOrId(cleanInput); } catch {}

      if (res) {
        if (timeoutStatus.isAutoClosed && res.status !== 'Closed') res.status = 'Closed';
        setTrackedRecord(res);
        try { setTrackedUpdates(await getComplaintUpdates(res.id)); } catch {}
        return;
      }

      if (storedResponses.length > 0) {
        const first = storedResponses[0];
        setTrackedRecord({
          id: first.complaintId || cleanInput, complaint_number: first.complaintNumber || cleanInput,
          title: 'Official Adjudication Case', description: 'Case record retrieved from AICTE Central Regulatory Database.',
          status: timeoutStatus.isAutoClosed ? 'Closed' : 'Under Review', category: 'Regulatory Inquiry', priority: 'Normal',
          assigned_department_id: 'd0000000-0000-0000-0000-000000000002', institution_id: institutionId || 'inst-001',
          created_at: first.createdAt || new Date().toISOString(),
          institution: { id: 'inst-001', institution_name: selectedTargetInstitution?.institution_name || 'Apex Institute of Pharmaceutical Sciences', aicte_permanent_id: selectedTargetInstitution?.aicte_permanent_id || '1-7102948210', state: selectedTargetInstitution?.state || 'Uttar Pradesh', district: null, institution_type: 'Engineering', address: 'New Delhi', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          department: { id: 'd0000000-0000-0000-0000-000000000002', code: 'PGRC', name: 'Public Grievance Redressal Cell', description: '', created_at: new Date().toISOString() },
        } as unknown as ComplaintWithRelations);
        return;
      }

      const localSubmissionsRaw = localStorage.getItem('aicte_user_submissions') || '[]';
      let localSubmissions: Array<{ email?: string; complaintNumber?: string; submittedAt?: string }> = [];
      try { localSubmissions = JSON.parse(localSubmissionsRaw); } catch {}
      const localMatch = localSubmissions.find(sub => (sub.complaintNumber || '').toUpperCase() === cleanInput);

      if (localMatch || /^AICTE-\d{4}-\d+$/i.test(cleanInput)) {
        setTrackedRecord({
          id: cleanInput, complaint_number: cleanInput, title: title.trim() || 'Grievance Under Statutory Review',
          description: description.trim() || 'Grievance registered and acknowledged in the AICTE Central Repository. Awaiting officer inspection and preliminary bureau directive.',
          status: 'Received', category: category || 'Fee Cap Violation', priority: 'Normal',
          assigned_department_id: 'd0000000-0000-0000-0000-000000000002', institution_id: institutionId || 'inst-001',
          created_at: localMatch?.submittedAt || new Date().toISOString(),
          institution: { id: institutionId || 'inst-001', institution_name: selectedTargetInstitution?.institution_name || currentCitizen?.institutionName || 'Aryavart Institute of Technical Education', aicte_permanent_id: selectedTargetInstitution?.aicte_permanent_id || '1-6291048201', state: selectedTargetInstitution?.state || 'Rajasthan', district: null, institution_type: 'Engineering', address: selectedTargetInstitution?.address || 'Jaipur, RJ', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
          department: { id: 'd0000000-0000-0000-0000-000000000002', code: CATEGORY_BUREAU_MAP[category] || 'PGRC', name: 'Public Grievance Redressal Cell', description: '', created_at: new Date().toISOString() },
        } as unknown as ComplaintWithRelations);
        return;
      }
      setTrackError(`No complaint found with Reference ID "${cleanInput}". Please verify the case number.`);
    } catch (err: unknown) {
      setTrackError((err as { message?: string })?.message || 'Failed to search complaint.');
    } finally {
      setIsSearchingTrack(false);
    }
  };

  const resetForm = () => {
    setSuccessComplaintNumber(null); setTitle(''); setDescription(''); setCategory(COMPLAINT_CATEGORIES[0]);
    setDeclarationChecked(false); setEvidenceItems([]); setEvidenceFiles([]);
    setSimilarCases([]); setJoinedCount(null); setJoinError(null);
  };

  const selectedTargetInstitution = institutions.find(i => i.id === institutionId);
  const nextGrievanceEligibleDate = check7DaySubmissionRestriction(complainantEmail).nextEligibleDate;

  if (successComplaintNumber) {
    return (
      <div className="min-h-screen bg-slate-100 font-sans">
        <div className="h-1 w-full flex"><div className="flex-1 bg-[#FF9933]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#138808]" /></div>
        <div className="max-w-lg mx-auto px-4 py-16">
          <div className="bg-white border border-slate-200 rounded shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle2 className="w-9 h-9" /></div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Submission Successful</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{joinedCount !== null ? 'You Have Joined an Existing Complaint' : 'Grievance Registered Successfully'}</h2>
            <p className="text-xs text-slate-600 mb-4">{joinedCount !== null ? 'Others at your institution reported the same problem, so AICTE will handle it as one mass complaint.' : 'Your grievance has been permanently registered in the AICTE Central Repository.'}</p>
            <div className="bg-slate-50 border border-slate-200 rounded p-4 font-mono text-sm text-slate-800 font-bold mb-4">
              {joinedCount !== null ? 'Case ID' : 'Official Grievance ID'}: <span className="text-[#0b3b60]">{successComplaintNumber}</span>
              {joinedCount !== null && <div className="mt-2 font-sans text-xs font-semibold text-amber-800 flex items-center justify-center space-x-1.5"><Users className="w-4 h-4" /><span>{joinedCount} persons are now affected in this case</span></div>}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-900 mb-6 text-left space-y-1">
              <div className="font-semibold flex items-center space-x-1.5"><Smartphone className="w-3.5 h-3.5 text-blue-700" /><span>SMS Notification Dispatched to: {complainantPhone}</span></div>
              <p className="text-[11px] text-blue-800">You will receive real-time SMS updates whenever an AICTE Bureau Officer issues directives or replies to this grievance.</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900 mb-6 text-left flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <p>You cannot file another grievance for 7 days.{nextGrievanceEligibleDate && ` You can file again on ${nextGrievanceEligibleDate}.`}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button type="button" onClick={() => { setTrackingMode(true); setTrackingNumber(successComplaintNumber); resetForm(); }} className="px-5 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm cursor-pointer">Track This Grievance →</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col">
      <div className="h-1 w-full flex"><div className="flex-1 bg-[#FF9933]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#138808]" /></div>
      <header className="bg-[#0b3b60] text-white py-4 shadow-md">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/aicte-emblem.png" alt="AICTE Emblem" className="w-10 h-10 object-contain drop-shadow-md shrink-0" />
            <div>
              <h1 className="text-sm font-bold tracking-wide">AICTE PUBLIC GRIEVANCE INTAKE PORTAL</h1>
              <p className="text-xs text-white/70">All India Council for Technical Education • Central Vigilance &amp; Redressal Platform</p>
            </div>
          </div>
        </div>
      </header>

      {showNotice && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 transition-all">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center space-x-2"><AlertCircle className="w-4 h-4 text-amber-700 shrink-0" /><span><strong>Public Notice:</strong> Technical students, parents, faculty, and institutions may register complaints against AICTE-approved institutions directly.</span></div>
            <button type="button" onClick={() => setShowNotice(false)} className="text-amber-700 hover:text-amber-900 ml-3 p-1 rounded hover:bg-amber-100 transition shrink-0 cursor-pointer" title="Dismiss Notice"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="flex items-center border-b border-slate-300 mb-6">
          <button type="button" onClick={() => setTrackingMode(false)} className={`px-5 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${!trackingMode ? 'border-[#0b3b60] text-[#0b3b60] bg-white rounded-t' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Register Public Grievance</button>
          <button type="button" onClick={() => setTrackingMode(true)} className={`px-5 py-2.5 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${trackingMode ? 'border-[#0b3b60] text-[#0b3b60] bg-white rounded-t' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Search className="w-3.5 h-3.5" /><span>Track Grievance Status</span></button>
        </div>

        {trackingMode ? (
          <div className="bg-white border border-slate-200 rounded shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Grievance Tracking &amp; Official Response Status</h3>
              <p className="text-xs text-slate-500">Enter your Grievance ID / Case Number to track live bureau actions, official replies, and SMS notifications.</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); handleTrackSearch(); }} className="flex gap-2 max-w-lg">
              <input type="text" value={trackingNumber} onChange={e => setTrackingNumber(e.target.value.toUpperCase())} placeholder="e.g. AICTE-2026-01057" className="flex-1 text-xs border border-slate-300 rounded px-3 py-2.5 font-mono uppercase bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" />
              <button type="submit" disabled={isSearchingTrack || !trackingNumber.trim()} className="px-5 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-semibold rounded shadow-sm disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer">
                {isSearchingTrack ? <span className="animate-pulse">Searching...</span> : <><Search className="w-3.5 h-3.5" /><span>Search</span></>}
              </button>
            </form>
            {trackError && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-center space-x-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" /><span>{trackError}</span></div>}
            {trackedRecord && (
              <div className="border border-slate-200 rounded p-5 bg-slate-50 space-y-5">
                {autoCloseInfo.isAutoClosed && (
                  <div className="p-4 bg-red-50 border-2 border-red-300 rounded-md text-xs text-red-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5 text-red-800 text-sm"><AlertTriangle className="w-4 h-4 text-red-600" /><span>CASE CLOSED AUTOMATICALLY BY SYSTEM</span></div>
                    <p className="leading-relaxed"><strong>Reason:</strong> {autoCloseInfo.reason || 'Failed to submit necessary proofs within 15 calendar days.'}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-200 gap-2">
                  <div><span className="text-xs font-bold text-[#0b3b60] font-mono">{trackedRecord.complaint_number}</span><h4 className="text-sm font-bold text-slate-900 mt-0.5">{trackedRecord.title}</h4></div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${autoCloseInfo.isAutoClosed || trackedRecord.status === 'Closed' ? 'bg-slate-200 text-slate-800 border border-slate-400' : trackedRecord.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : trackedRecord.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {autoCloseInfo.isAutoClosed ? 'Closed (Proof Timeout)' : trackedRecord.status}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><span className="text-slate-500 block">Institution:</span><span className="font-semibold text-slate-800">{trackedRecord.institution?.institution_name || 'N/A'}</span></div>
                  <div><span className="text-slate-500 block">Responsible Bureau:</span><span className="font-semibold text-slate-800">{trackedRecord.department?.name || 'Assigned Bureau'}</span></div>
                  <div><span className="text-slate-500 block">Category:</span><span className="font-semibold text-slate-800">{trackedRecord.category}</span></div>
                  <div><span className="text-slate-500 block">Filed On:</span><span className="font-semibold text-slate-800">{new Date(trackedRecord.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                </div>
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800 block mb-1">Grievance Allegation on Record:</span>
                  <p className="bg-white p-3 rounded border border-slate-200 text-slate-700 whitespace-pre-wrap">{trackedRecord.description}</p>
                </div>
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center space-x-1.5"><FileText className="w-4 h-4 text-[#0b3b60]" /><span>Official Bureau Responses &amp; Directives ({trackedResponses.length + trackedUpdates.length})</span></h5>
                  {trackedResponses.length === 0 && trackedUpdates.length === 0 ? (
                    <div className="bg-white p-4 rounded border border-slate-200 text-xs text-slate-500 text-center">No official response has been dispatched by the Bureau Officer yet. You will receive an SMS notification once a directive or relief order is issued.</div>
                  ) : (
                    <div className="space-y-3">
                      {trackedResponses.map(r => (
                        <div key={r.id} className="bg-white p-4 rounded-md border border-blue-200 space-y-2 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
                            <div><span className="font-bold text-[#0b3b60] text-xs">{r.dispatchType}</span><span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">Ref: {r.refNo}</span></div>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">{r.responseBody}</div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 text-[11px] text-slate-600 gap-1">
                            <span className="flex items-center space-x-1.5 text-emerald-700 font-medium"><Smartphone className="w-3.5 h-3.5 text-emerald-600" /><span>SMS Delivered ({r.smsDispatchedTo})</span></span>
                            <span className="text-slate-500">Issued by: <strong className="text-slate-700">{r.officerName}</strong> ({r.officerBureau})</span>
                          </div>
                          {r.requiresProof && (
                            <div className={`p-2.5 rounded text-[11px] ${r.isAutoClosedTimeout ? 'bg-red-50 text-red-900 border border-red-200 font-bold' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                              {r.isAutoClosedTimeout ? '❌ Case automatically closed: 15-day document deadline expired.' : '⚠️ Mandatory 15-Day Proof Notice: Please submit certified documents within 15 calendar days.'}
                            </div>
                          )}
                        </div>
                      ))}
                      {trackedUpdates.map(u => (
                        <div key={u.id} className="bg-white p-3.5 rounded border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500"><span className="font-semibold text-slate-800">{u.author?.full_name || 'AICTE Officer'}</span><span className="font-mono text-slate-400">{new Date(u.created_at).toLocaleString()}</span></div>
                          <p className="text-slate-700 whitespace-pre-wrap text-[11px]">{u.update_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : !currentCitizen ? (
          <div className="bg-white border border-slate-200 rounded shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-[#0b3b60] to-[#072a45] text-white p-6 sm:p-7">
              <div className="flex items-center space-x-3 mb-2"><div className="p-2 bg-white/10 rounded-md"><ShieldCheck className="w-5 h-5 text-amber-300" /></div><div><h2 className="text-base sm:text-lg font-bold">AICTE Public Grievance Registration &amp; Citizen Gateway</h2><p className="text-xs text-blue-100">Mandatory Registration Required Before Lodging a Public Grievance</p></div></div>
              <p className="text-xs text-blue-100/90 leading-relaxed mt-2 bg-black/20 p-3 rounded border border-white/10"><strong>AICTE Redressal Norms:</strong> New complainants must create a one-time registration with their verified email and mobile number.</p>
            </div>
            <div className="flex border-b border-slate-200 bg-slate-50">
              <button type="button" onClick={() => { setAuthTab('register'); setRegError(null); setLoginError(null); }} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition cursor-pointer ${authTab === 'register' ? 'border-[#0b3b60] text-[#0b3b60] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><UserPlus className="w-4 h-4" /><span>New Citizen / Student Registration</span></button>
              <button type="button" onClick={() => { setAuthTab('login'); setRegError(null); setLoginError(null); }} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition cursor-pointer ${authTab === 'login' ? 'border-[#0b3b60] text-[#0b3b60] bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><LogIn className="w-4 h-4" /><span>Already Registered? Citizen Login</span></button>
            </div>
            {authTab === 'register' ? (
              <form onSubmit={handleRegistrationSubmit} className="p-6 space-y-5">
                {regError && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /><span>{regError}</span></div>}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">Complainant Category <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[{ key: 'Student', label: 'Student', icon: GraduationCap }, { key: 'Faculty', label: 'Faculty / Staff', icon: Briefcase }, { key: 'Parent', label: 'Parent / Guardian', icon: User }, { key: 'Institution', label: 'Institution', icon: Building2 }].map(item => {
                      const IconComp = item.icon;
                      const isSel = regCategory === item.key;
                      return <button key={item.key} type="button" onClick={() => { setRegCategory(item.key as typeof regCategory); setRegRollNo(''); }} className={`p-3 border rounded text-center transition flex flex-col items-center justify-center space-y-1 cursor-pointer ${isSel ? 'border-[#0b3b60] bg-blue-50/70 text-[#0b3b60] font-bold ring-1 ring-[#0b3b60]' : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'}`}><IconComp className="w-4 h-4" /><span className="text-xs">{item.label}</span></button>;
                    })}
                  </div>
                </div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name <span className="text-red-500">*</span></label><input type="text" value={regFullName} onChange={e => setRegFullName(e.target.value)} placeholder="e.g. Rahul Sharma" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official / Correspondence Email ID <span className="text-red-500">*</span></label>
                  <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="e.g. rahul.sharma@example.com" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" />
                  <div className="mt-1.5 p-2.5 bg-red-50 border border-red-500 rounded text-red-700 text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" /><span>When an email is registered then it is permanent</span></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number <span className="text-red-500">*</span></label><input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="+91 98765 43210" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /><span className="text-[10px] text-slate-500">Compulsory for receiving official SMS orders</span></div>
                  {registrationIdentityField && <div><label className="block text-xs font-semibold text-slate-700 mb-1">{registrationIdentityField.label} <span className="text-red-500">*</span></label><input type="text" value={regRollNo} onChange={e => setRegRollNo(e.target.value)} placeholder={registrationIdentityField.placeholder} required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /><span className="text-[10px] text-slate-500">Compulsory identity identifier</span></div>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Your AICTE-Approved Institution <span className="text-red-500">*</span></label>
                  <input type="text" value={regInstSearch} onChange={e => setRegInstSearch(e.target.value)} placeholder="Search institution by name, permanent ID, or state..." className="w-full text-xs border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60] mb-1.5" />
                  <select value={regInstitutionId} onChange={e => { setRegInstitutionId(e.target.value); const sel = institutions.find(i => i.id === e.target.value); if (sel) setRegInstSearch(sel.institution_name); }} required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60] cursor-pointer">
                    <option value="">-- Select Your AICTE-Approved Institution --</option>
                    {filteredRegInstitutions.map(inst => <option key={inst.id} value={inst.id}>{inst.institution_name} [{inst.aicte_permanent_id || 'ID Pending'}] — {inst.state}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Create Portal Password / PIN <span className="text-red-500">*</span></label><input type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••••••" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                  <button type="button" onClick={() => setAuthTab('login')} className="text-xs text-[#0b3b60] hover:underline font-semibold cursor-pointer">Already registered? Go to Login →</button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold rounded shadow-sm flex items-center justify-center space-x-2 cursor-pointer"><UserPlus className="w-4 h-4 text-emerald-400" /><span>Register Permanent Account &amp; Proceed</span></button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCitizenLoginSubmit} className="p-6 space-y-5">
                {loginError && <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /><span>{loginError}</span></div>}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-1"><strong>Verification Notice:</strong> Under AICTE compliance rules, only email IDs registered during New Registration are accepted for login.</div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Registered Email Address <span className="text-red-500">*</span></label><input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="e.g. aarav.sharma@coep.ac.in" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Password / PIN <span className="text-red-500">*</span></label><input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••••••" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                  <button type="button" onClick={() => setAuthTab('register')} className="text-xs text-[#0b3b60] hover:underline font-semibold cursor-pointer">← Not registered yet? Create New Registration</button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold rounded shadow-sm flex items-center justify-center space-x-2 cursor-pointer"><LogIn className="w-4 h-4 text-emerald-400" /><span>Login &amp; Open Grievance Desk</span></button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded shadow-sm">
            <div className="bg-emerald-50/80 border-b border-emerald-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></div>
                <div>
                  <div className="text-xs font-bold text-emerald-900 flex items-center space-x-2"><span>Authenticated: {currentCitizen.fullName}</span><span className="bg-emerald-200 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">{currentCitizen.category}</span></div>
                  <div className="text-[11px] text-emerald-700 font-mono">{currentCitizen.email} {currentCitizen.rollNo && `• ID: ${currentCitizen.rollNo}`} • Mobile: {currentCitizen.phone}</div>
                </div>
              </div>
              <button type="button" onClick={() => { sessionStorage.removeItem('aicte_public_citizen'); setCurrentCitizen(null); }} className="text-xs text-emerald-800 hover:text-red-700 font-semibold flex items-center space-x-1 shrink-0 px-2 py-1 rounded hover:bg-emerald-100 transition cursor-pointer"><LogOut className="w-3.5 h-3.5" /><span>Switch / Sign Out</span></button>
            </div>
            {errorMessage && <div className="m-6 mb-0 p-3.5 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /><span>{errorMessage}</span></div>}
            <form onSubmit={handlePreSubmit} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5"><User className="w-4 h-4 text-[#0b3b60]" /><span>1. COMPLAINANT IDENTIFICATION</span></h3></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label><input type="text" value={complainantName} onChange={e => setComplainantName(e.target.value)} placeholder="e.g. Rahul Sharma" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                    <select value={complainantType} onChange={e => { setComplainantType(e.target.value); setStudentRollNo(''); }} className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]">
                      <option value="Student">Student</option><option value="Faculty">Faculty / Staff</option><option value="Parent">Parent</option><option value="Institution">Institution</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input type="email" value={complainantEmail} disabled className="w-full text-xs border border-slate-200 rounded px-3 py-2 bg-slate-50 text-slate-700 font-mono cursor-not-allowed" />
                    <div className="mt-1 p-1 bg-red-50 border border-red-300 rounded text-red-700 text-[10px] font-semibold">When an email is registered then it is permanent</div>
                  </div>
                  <div><label className="block text-xs font-semibold text-slate-700 mb-1">Mobile (SMS updates) <span className="text-red-500">*</span></label><input type="tel" value={complainantPhone} onChange={e => setComplainantPhone(e.target.value)} placeholder="+91 98765 43210" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                </div>
                {complaintIdentityField && <div><label className="block text-xs font-semibold text-slate-700 mb-1">{complaintIdentityField.label} <span className="text-red-500">*</span></label><input type="text" value={studentRollNo} onChange={e => setStudentRollNo(e.target.value)} placeholder={complaintIdentityField.placeholder} required className="w-full sm:w-1/2 text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>}
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5"><Building2 className="w-4 h-4 text-[#0b3b60]" /><span>2. INSTITUTION SUBJECT TO GRIEVANCE</span></h3></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select AICTE Institution <span className="text-red-500">*</span></label>
                  <input type="text" value={institutionSearch} onFocus={() => setShowInstitutionResults(true)} onChange={e => { setInstitutionSearch(e.target.value); setInstitutionId(''); setShowInstitutionResults(true); }} placeholder="Type institution name, AICTE ID, or state..." role="combobox" aria-expanded={showInstitutionResults} required className="w-full text-xs border border-slate-300 rounded px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" />
                  {showInstitutionResults && (
                    <ul className="mt-1 max-h-60 overflow-y-auto rounded border border-slate-200 bg-white shadow-sm">
                      {matchingInstitutions.length > 0 ? matchingInstitutions.map(inst => (
                        <li key={inst.id}><button type="button" onClick={() => { setInstitutionId(inst.id); setInstitutionSearch(`${inst.institution_name} [${inst.aicte_permanent_id || 'ID Pending'}] — ${inst.state}`); setShowInstitutionResults(false); }} className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50 focus:outline-none cursor-pointer">{inst.institution_name} [{inst.aicte_permanent_id || 'ID Pending'}] — {inst.state}</button></li>
                      )) : <li className="px-3 py-2 text-xs text-slate-500">No matching institutions found.</li>}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-2"><h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5"><Tag className="w-4 h-4 text-[#0b3b60]" /><span>3. GRIEVANCE PARTICULARS</span></h3></div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Subject / Title <span className="text-red-500">*</span></label><input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Summary of grievance" required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select value={category} onChange={e => setCategory(e.target.value)} required className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]">
                    {COMPLAINT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Auto-allocated Bureau: <strong className="text-[#0b3b60]">{CATEGORY_BUREAU_MAP[category] || 'PGRC'} Desk</strong></p>
                </div>
                <div><label className="block text-xs font-semibold text-slate-700 mb-1">Details &amp; Chronological Facts <span className="text-red-500">*</span></label><textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain the grievance chronologically with all specific details..." required className="w-full text-xs border border-slate-300 rounded p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]" /></div>
                <EvidenceUploader claimedText={`${title}\n${description}`} complainantName={complainantName} institutionName={institutions.find(i => i.id === institutionId)?.institution_name} onChange={(items, files) => { setEvidenceItems(items); setEvidenceFiles(files); }} />
              </div>

              <div className="bg-slate-50 border border-slate-300 rounded-md p-4 text-xs text-slate-800 space-y-2">
                <div className="flex items-start space-x-3">
                  <input type="checkbox" id="legalDeclarationCheckbox" checked={declarationChecked} onChange={e => setDeclarationChecked(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#0b3b60] cursor-pointer shrink-0" required />
                  <label htmlFor="legalDeclarationCheckbox" className="cursor-pointer select-none"><strong>Legal Declaration:</strong> I hereby declare that the particulars submitted are true and authentic.</label>
                </div>
                {!declarationChecked && <p className="text-[11px] text-amber-700 pl-7 font-medium">⚠️ You must check the declaration box above to enable submission.</p>}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
                <button type="submit" disabled={!declarationChecked || isCheckingSimilar} className={`px-6 py-2.5 text-xs font-semibold rounded shadow-sm flex items-center space-x-2 transition ${declarationChecked ? 'bg-[#0b3b60] hover:bg-[#072a45] text-white cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'}`}>
                  {isCheckingSimilar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}<span>{isCheckingSimilar ? 'Checking for similar complaints...' : 'Proceed to Verification & Submit'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden">
            <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5"><AlertTriangle className="w-6 h-6 text-white shrink-0" /><div><h3 className="text-sm font-bold uppercase tracking-wide">Verify Grievance Particulars</h3><p className="text-xs text-amber-100">AICTE Verification Step</p></div></div>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="text-white/80 hover:text-white p-1 rounded hover:bg-amber-600 transition cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-amber-900"><strong>Attention:</strong> Please review all entered details thoroughly before final submission.</div>
              <div className="border border-slate-200 rounded-md divide-y divide-slate-200 bg-slate-50">
                <div className="p-3 grid grid-cols-2 gap-2"><div><span className="text-slate-500 block text-[11px]">Complainant Name</span><span className="font-bold text-slate-900">{complainantName}</span></div><div><span className="text-slate-500 block text-[11px]">Role</span><span className="font-semibold text-slate-800">{complainantType}</span></div></div>
                <div className="p-3 grid grid-cols-2 gap-2"><div><span className="text-slate-500 block text-[11px]">Email ID</span><span className="font-mono text-slate-800">{complainantEmail}</span></div><div><span className="text-slate-500 block text-[11px]">Mobile</span><span className="font-mono text-slate-800">{complainantPhone}</span></div></div>
                {complaintIdentityField && <div className="p-3"><span className="text-slate-500 block text-[11px]">{complaintIdentityField.label}</span><span className="font-mono text-slate-800 font-bold">{studentRollNo}</span></div>}
                <div className="p-3"><span className="text-slate-500 block text-[11px]">Institution</span><span className="font-bold text-slate-900">{selectedTargetInstitution?.institution_name || 'Selected Institution'}</span></div>
                <div className="p-3 grid grid-cols-2 gap-2"><div><span className="text-slate-500 block text-[11px]">Category</span><span className="font-semibold text-slate-800">{category}</span></div><div><span className="text-slate-500 block text-[11px]">Bureau</span><span className="font-bold text-[#0b3b60]">{CATEGORY_BUREAU_MAP[category] || 'PGRC'}</span></div></div>
                <div className="p-3"><span className="text-slate-500 block text-[11px]">Subject</span><span className="font-bold text-slate-900">{title}</span></div>
                <div className="p-3"><span className="text-slate-500 block text-[11px] mb-1">Description</span><p className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 whitespace-pre-wrap max-h-28 overflow-y-auto font-mono text-[11px]">{description}</p></div>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-end space-x-3">
              <button type="button" onClick={() => setShowConfirmModal(false)} disabled={isSubmitting} className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded transition cursor-pointer">Review &amp; Edit</button>
              <button type="button" onClick={handleFinalSubmit} disabled={isSubmitting} className="px-5 py-2 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold rounded shadow-sm flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer">
                {isSubmitting ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Submitting...</span></> : <><Check className="w-4 h-4 text-emerald-400" /><span>Confirm &amp; Final Submit</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSimilarModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded shadow-xl max-w-xl w-full border border-slate-300">
            <div className="px-6 py-4 border-b border-slate-200 bg-amber-50 flex items-start space-x-3">
              <Users className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
              <div><h3 className="text-sm font-bold text-amber-900">Similar Complaint Found</h3><p className="text-xs text-amber-800 mt-0.5">Others at your institution already reported a similar issue.</p></div>
            </div>
            <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
              {similarCases.map(m => (
                <div key={m.complaint.id} className="border border-slate-200 rounded p-3 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-mono font-bold text-[#0b3b60]">{m.complaint.complaint_number}</div><div className="font-semibold text-slate-900">{m.complaint.title}</div><div className="text-[11px] text-slate-500">{m.complaint.category} • {m.complaint.status}</div></div>
                    <div className="text-right shrink-0"><div className="text-xl font-extrabold text-amber-700 leading-none">{m.complaint.affected_count || 1}</div><div className="text-[10px] text-slate-500">affected</div></div>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-3">{m.complaint.description}</p>
                  <button type="button" disabled={joiningId !== null} onClick={() => handleJoinExisting(m)} className="px-3 py-1.5 bg-[#0b3b60] hover:bg-[#072a45] disabled:opacity-50 text-white text-xs font-bold rounded flex items-center space-x-1.5 cursor-pointer">
                    {joiningId === m.complaint.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5 text-amber-300" />}<span>Join this complaint</span>
                  </button>
                </div>
              ))}
              {joinError && <p className="text-xs text-red-600">{joinError}</p>}
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
              <button type="button" onClick={() => setShowSimilarModal(false)} disabled={joiningId !== null} className="text-xs text-slate-600 underline cursor-pointer">Go back and edit</button>
              <button type="button" disabled={joiningId !== null} onClick={() => { setShowSimilarModal(false); setShowConfirmModal(true); }} className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded cursor-pointer">File separately</button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left space-y-2 sm:space-y-0">
          <div>AICTE Cross-Bureau Complaint Coordination Platform • SIH-26264</div>
          <div className="text-slate-500">Regulation Bureau (RB) • Public Grievance Redressal Cell (PGRC) • Approval Bureau (AB)</div>
        </div>
      </footer>
    </div>
  );
};