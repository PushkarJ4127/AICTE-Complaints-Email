import React, { useState, useEffect } from 'react';
import { getInstitutions, type Institution } from '../services/supabase/institutions';
import {
  ingestExternalComplaint,
  getComplaints,
  getExternalStreamHistory,
  type ExternalStreamItem,
} from '../services/supabase/complaints';
import { detectOverlaps, type OverlapAlert } from '../features/overlap-engine/overlapDetector';
import type { ComplaintPriority } from '../types/database.types';
import {
  Send,
  Building2,
  CheckCircle2,
  Search,
  Sparkles,
  ArrowLeft,
  FileText,
  Printer,
  ChevronRight,
  Phone,
  Mail,
  RefreshCw,
  Radio,
  X,
  Eye,
  ShieldCheck,
  Download,
  AlertCircle,
  User,
  Lock,
  Clock,
  ChevronDown,
  Info,
} from 'lucide-react';

interface ExternalIntakePortalsProps {
  onNavigateToDashboard?: () => void;
  onNavigateToCase?: (id: string) => void;
  onNavigateToOverlap?: () => void;
  onGoBack?: () => void;
}

export const ExternalIntakePortals: React.FC<ExternalIntakePortalsProps> = ({
  onNavigateToDashboard,
  onNavigateToCase,
  onNavigateToOverlap,
  onGoBack,
}) => {
  // Navigation between CSS and Ingested Stream
  const [activePortal, setActivePortal] = useState<'cpgrams' | 'css' | 'stream'>('cpgrams');

  // CPGRAMS Sub-Views: 'home' | 'lodge_public' | 'lodge_pension' | 'status' | 'reminder' | 'appeal'
  const [cpgramsView, setCpgramsView] = useState<'home' | 'lodge_public' | 'status'>('home');

  // Navbar Dropdowns state
  const [activeDropdown, setActiveDropdown] = useState<'view_status' | 'nodal_officers' | 'redress_process' | 'grievance' | null>(null);

  // Modals state
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showRedressFlowModal, setShowRedressFlowModal] = useState(false);
  const [showCitizenCharterModal, setShowCitizenCharterModal] = useState(false);
  const [showNodalOfficersModal, setShowNodalOfficersModal] = useState<'central' | 'state' | null>(null);
  const [showNodalAuthorityAppealModal, setShowNodalAuthorityAppealModal] = useState(false);
  const [showMobileAppModal, setShowMobileAppModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showPensionModal, setShowPensionModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);

  // Status Search State
  const [statusTab, setStatusTab] = useState<'grievance' | 'appeal'>('grievance');
  const [statusRegNo, setStatusRegNo] = useState('');
  const [statusPhoneOrEmail, setStatusPhoneOrEmail] = useState('');
  const [statusCaptchaInput, setStatusCaptchaInput] = useState('');
  const [generatedCaptcha, setGeneratedCaptcha] = useState('7K94M');
  const [searchedStatusResult, setSearchedStatusResult] = useState<{
    regNo: string;
    source: string;
    subject: string;
    institution: string;
    date: string;
    currentStatus: string;
    officer: string;
    officerContact: string;
    category: string;
    movements: Array<{
      date: string;
      action: string;
      office: string;
      remarks: string;
    }>;
  } | null>(null);
  const [statusSearchError, setStatusSearchError] = useState<string | null>(null);

  // Institution List
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  // Form Fields - CPGRAMS
  const [selectedInstId, setSelectedInstId] = useState('');
  const [category, setCategory] = useState('Fee Cap Violation');
  const [priority, setPriority] = useState<ComplaintPriority>('High');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [complainantName, setComplainantName] = useState('Rahul M. Sharma');
  const [complainantEmail, setComplainantEmail] = useState('rahul.sharma@gmail.com');
  const [complainantPhone, setComplainantPhone] = useState('+91 98112 33445');
  const [complainantType, setComplainantType] = useState('Student');
  const [studentRollNo, setStudentRollNo] = useState('2024-BTECH-098');
  const [stateName, setStateName] = useState('Delhi');

  // OTP simulation state
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    portalSource: 'CPGRAMS' | 'CSS';
    externalRefId: string;
    internalComplaintNumber: string;
    complaintId: string;
    institutionName: string;
    overlapDetected: boolean;
    matchingAlert?: OverlapAlert;
  } | null>(null);

  // Stream History
  const [streamHistory, setStreamHistory] = useState<ExternalStreamItem[]>([]);

  // Function to refresh Captcha
  const refreshCaptcha = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let res = '';
    for (let i = 0; i < 5; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedCaptcha(res);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const instList = await getInstitutions();
        setInstitutions(instList);
        setStreamHistory(getExternalStreamHistory());
      } catch (err) {
        console.error('Error loading data:', err);
      }
    }
    loadData();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Selected Institution
  const selectedInstitution = institutions.find((i) => i.id === selectedInstId);

  // Quick Scenario Fill for Live Demo
  const handleQuickPreset = (presetKey: 'delhi_fee' | 'vidyapeeth_faculty' | 'coep_docs') => {
    if (presetKey === 'delhi_fee') {
      const delhi = institutions.find((i) => i.id === 'a0000000-0000-0000-0000-000000000001') || institutions[0];
      if (delhi) {
        setSelectedInstId(delhi.id);
      }
      setCategory('Fee Cap Violation');
      setPriority('Urgent');
      setSubject('Unauthorized mandatory lab & development fee extortion under threat of semester debarment');
      setDescription(
        'Aggrieved student from B.Tech 3rd Semester. The college administration has issued an arbitrary circular demanding ₹45,000 cash per student as "Special Development Charge", withholding hall tickets for end-semester exams if unpaid. This is in direct violation of AICTE Fee Regulatory Committee guidelines and Supreme Court directives.'
      );
      setComplainantName('Karan Malhotra');
      setComplainantEmail('karan.malhotra@gmail.com');
      setComplainantPhone('+91 98114 77889');
      setComplainantType('Student');
      setStudentRollNo('DEL-2023-CS-071');
      setStateName('Delhi');
    } else if (presetKey === 'vidyapeeth_faculty') {
      const vidya = institutions.find((i) => i.id === 'a0000000-0000-0000-0000-000000000005') || institutions[4];
      if (vidya) {
        setSelectedInstId(vidya.id);
      }
      setCategory('Faculty Deficiency & Non-Payment of Remuneration');
      setPriority('High');
      setSubject('Withholding of 6 months faculty remuneration and statutory PF contributions');
      setDescription(
        'Assistant Professor representation on behalf of 24 teaching faculty members. Remuneration has not been credited since April 2026. The institution continues to collect full student tuition while defaulting on AICTE 7th Central Pay Commission recommendations and EPF deposits.'
      );
      setComplainantName('Dr. Suniti Verma');
      setComplainantEmail('suniti.verma@outlook.com');
      setComplainantPhone('+91 94250 88991');
      setComplainantType('Faculty');
      setStudentRollNo('FAC-VIST-042');
      setStateName('Madhya Pradesh');
    } else {
      const coep = institutions.find((i) => i.id === 'a0000000-0000-0000-0000-000000000002') || institutions[1];
      if (coep) {
        setSelectedInstId(coep.id);
      }
      setCategory('Withholding of Original Certificates');
      setPriority('High');
      setSubject('Non-return of original 10th and 12th marksheets after course completion');
      setDescription(
        'Student grievance regarding withholding of original educational certificates. Despite completing all academic credits and clearing all dues with official no-dues receipt, the student section refuses to return the original certificates.'
      );
      setComplainantName('Aarav Deshmukh');
      setComplainantEmail('aarav.d@gmail.com');
      setComplainantPhone('+91 98220 55441');
      setComplainantType('Student');
      setStudentRollNo('COEP-2022-ME-112');
      setStateName('Maharashtra');
    }
  };

  // Submit Complaint to CPGRAMS or CSS
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId) {
      alert('Please select the technical institution subject to this grievance.');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      alert('Please provide grievance subject and detailed description.');
      return;
    }
    if (!complainantEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(complainantEmail.trim())) {
      alert('Please provide a valid complainant email address. Status updates will be sent to this address.');
      return;
    }

    if (activePortal === 'cpgrams') {
      if (!otpSent) {
        alert('Please click "Send OTP" to receive verification code before submitting.');
        return;
      }
      if (otpValue.trim() !== '123456') {
        alert('Invalid OTP. Please enter the valid verification code: 123456');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const isCpgrams = activePortal === 'cpgrams';
      const source: 'CPGRAMS' | 'CSS' = isCpgrams ? 'CPGRAMS' : 'CSS';

      // Generate realistic External Reference ID
      // CPGRAMS format: DARPG/E/2026/0XXXX
      // CSS format: CSS-AICTE-2026-0XXXX
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const externalRefId = isCpgrams
        ? `DARPG/E/${new Date().getFullYear()}/0${randomSuffix}`
        : `CSS-AICTE-${new Date().getFullYear()}-0${randomSuffix}`;

      // Ingest into AICTE Central Registry (automatically assigned to PGRC)
      const createdComplaint = await ingestExternalComplaint({
        source,
        externalReferenceId: externalRefId,
        institutionId: selectedInstId,
        title: subject.trim(),
        description: description.trim(),
        category,
        priority,
        complainantName: complainantName.trim(),
        complainantEmail: complainantEmail.trim(),
        complainantPhone: complainantPhone.trim(),
        complainantType,
        studentRollNo: studentRollNo.trim() || undefined,
      });

      // Overlap analysis is best-effort. A read/analytics failure must never
      // turn a successfully committed database insert into a false failure message.
      let matchingAlert: OverlapAlert | undefined;
      try {
        const { data: allComplaints } = await getComplaints({ pageSize: 500 });
        const detectionResult = detectOverlaps(allComplaints);
        matchingAlert = detectionResult.alerts.find(
          (a) =>
            a.case_a_id === createdComplaint.complaint_number ||
            a.case_b_id === createdComplaint.complaint_number ||
            a.institution_id === selectedInstId
        );
      } catch (overlapError) {
        console.warn('Complaint was saved, but optional overlap analysis could not run:', overlapError);
      }

      setSubmissionSuccess({
        portalSource: source,
        externalRefId,
        internalComplaintNumber: createdComplaint.complaint_number,
        complaintId: createdComplaint.id,
        institutionName: selectedInstitution?.institution_name || 'Technical Institution',
        overlapDetected: Boolean(matchingAlert),
        matchingAlert,
      });

      setStreamHistory(getExternalStreamHistory());
    } catch (err) {
      console.error('Error submitting external complaint:', err);
      alert('Failed to submit grievance. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmissionSuccess(null);
    setSubject('');
    setDescription('');
    setOtpSent(false);
    setOtpValue('');
  };

  // Perform Status Lookup
  const handleStatusSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusSearchError(null);

    const query = statusRegNo.trim();
    if (!query) {
      setStatusSearchError('Please enter a valid Grievance Registration Number.');
      return;
    }

    if (statusCaptchaInput.trim().toUpperCase() !== generatedCaptcha.toUpperCase()) {
      setStatusSearchError('Invalid Security Code (Captcha). Please enter the characters shown in the box.');
      refreshCaptcha();
      return;
    }

    // Try finding in stream history
    const matched = streamHistory.find(
      (item) =>
        item.externalReferenceId.toLowerCase() === query.toLowerCase() ||
        item.internalComplaintNumber.toLowerCase() === query.toLowerCase()
    );

    if (matched) {
      setSearchedStatusResult({
        regNo: matched.externalReferenceId,
        source: matched.source,
        subject: `${matched.category} Representation - ${matched.institutionName}`,
        institution: matched.institutionName,
        date: new Date(matched.submittedAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        currentStatus: 'UNDER PROCESS (FORWARDED TO AICTE-PGRC)',
        officer: 'Shri R.K. Soni, Director (PGRC)',
        officerContact: '011-29581000 / pgrc@aicte-india.org',
        category: matched.category,
        movements: [
          {
            date: new Date(matched.submittedAt).toLocaleDateString('en-IN') + ' 10:15 AM',
            action: 'Grievance Lodged by Citizen',
            office: 'CPGRAMS Central Gateway (DARPG)',
            remarks: 'Registration confirmed. Forwarded to Nodal Ministry.',
          },
          {
            date: new Date(matched.submittedAt).toLocaleDateString('en-IN') + ' 10:16 AM',
            action: 'Electronically Ingested & Docketed',
            office: 'Ministry of Education (Dept of Higher Education)',
            remarks: 'Transferred to Subordinate Organization: AICTE.',
          },
          {
            date: new Date(matched.submittedAt).toLocaleDateString('en-IN') + ' 10:18 AM',
            action: 'Assigned to Public Grievance Redressal Cell (PGRC)',
            office: 'AICTE Headquarters, Nelson Mandela Marg, New Delhi',
            remarks: `Master Docket ID ${matched.internalComplaintNumber} created. Preliminary assessment initiated.`,
          },
        ],
      });
    } else {
      // Return a realistic mock record for any entered registration number
      const now = new Date();
      setSearchedStatusResult({
        regNo: query.toUpperCase(),
        source: 'CPGRAMS',
        subject: 'Irregularity in technical educational institution compliance standards',
        institution: 'Delhi College of Engineering & Technology [1-3329104]',
        date: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        currentStatus: 'UNDER SCRUTINY - SCSC STANDING COMMITTEE',
        officer: 'Dr. Mamta Agarwal, Joint Director (Public Grievance)',
        officerContact: '011-29581014 / grievance-officer@aicte-india.org',
        category: 'Fee Cap Violation & Mandatory Charges',
        movements: [
          {
            date: '18 Oct 2026, 11:30 AM',
            action: 'Grievance Registered in CPGRAMS Portal',
            office: 'DARPG Portal Engine',
            remarks: 'Unique Registration ID acknowledged to citizen.',
          },
          {
            date: '19 Oct 2026, 02:45 PM',
            action: 'Transferred to Concerned Technical Regulator',
            office: 'Ministry of Education, GOI',
            remarks: 'Transferred to AICTE for examination as per citizen charter.',
          },
          {
            date: '21 Oct 2026, 04:10 PM',
            action: 'Notice for Explanation Issued to Institution Head',
            office: 'AICTE Public Grievance Redressal Cell (PGRC)',
            remarks: 'Explanation sought within 10 days regarding the grievance contents.',
          },
        ],
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col font-sans">
      {/* Top Global Inter-Portal Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
              AICTE Data Interoperability Connector Active
            </span>
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">
              External Intake Ingestion &amp; Cross-Bureau Overlap Engine (SIH-26264)
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {onNavigateToDashboard && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center space-x-1"
              >
                <span>AICTE Integrated Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1 pl-2 border-l border-slate-700"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Exit Simulator</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Portal Switcher Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex space-x-2 sm:space-x-4">
            <button
              type="button"
              onClick={() => {
                setActivePortal('cpgrams');
                setSubmissionSuccess(null);
              }}
              className={`py-3.5 px-3 sm:px-5 text-xs font-bold flex items-center space-x-2 border-b-2 transition ${
                activePortal === 'cpgrams'
                  ? 'border-[#e67e22] text-[#0b3b60] bg-orange-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="text-base">🇮🇳</span>
              <span>CPGRAMS Portal (Govt of India - pgportal.gov.in)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePortal('css');
                setSubmissionSuccess(null);
              }}
              className={`py-3.5 px-3 sm:px-5 text-xs font-bold flex items-center space-x-2 border-b-2 transition ${
                activePortal === 'css'
                  ? 'border-[#0b3b60] text-[#0b3b60] bg-blue-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#0b3b60]" />
              <span>AICTE CSS Portal (Centralized Support System)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePortal('stream');
                setSubmissionSuccess(null);
                setStreamHistory(getExternalStreamHistory());
              }}
              className={`py-3.5 px-3 sm:px-5 text-xs font-bold flex items-center space-x-2 border-b-2 transition ${
                activePortal === 'stream'
                  ? 'border-purple-600 text-purple-900 bg-purple-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Radio className="w-4 h-4 text-purple-600" />
              <span>Live Ingested Feed ({streamHistory.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="w-full mx-auto flex-1">
        {/* SUCCESS ACKNOWLEDGEMENT RECEIPT */}
        {submissionSuccess && (
          <div className="max-w-6xl mx-auto px-4 pt-6">
            <div className="bg-white border border-slate-300 rounded-lg shadow-lg overflow-hidden mb-6 animate-in fade-in zoom-in-95 duration-200">
              {/* Header of Receipt */}
              <div
                className={`p-6 text-white ${
                  submissionSuccess.portalSource === 'CPGRAMS'
                    ? 'bg-gradient-to-r from-[#993300] to-[#c2410c]'
                    : 'bg-gradient-to-r from-[#0b3b60] to-[#072a45]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-white/10 rounded-full">
                      <CheckCircle2 className="w-7 h-7 text-emerald-300" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-amber-200 font-bold block">
                        Official Registration Acknowledgement (पावती)
                      </span>
                      <h2 className="text-xl font-bold">
                        Grievance Successfully Registered on {submissionSuccess.portalSource}
                      </h2>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-[11px] text-white/80">Official Tracking Reference:</div>
                    <div className="text-base font-bold text-amber-200">
                      {submissionSuccess.externalRefId}
                    </div>
                  </div>
                </div>
              </div>

              {/* REAL-TIME OVERLAP ALERT BANNER (SIH Core Innovation) */}
              {submissionSuccess.overlapDetected && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-100 border-b-2 border-amber-400 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-amber-500 text-white rounded shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5 text-amber-100" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-amber-950">
                          🚨 Real-Time Cross-Bureau Overlap Engine Triggered!
                        </span>
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                          Coordination Required
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        <strong>AICTE-Samadhan Overlap Engine:</strong> This grievance concerns{' '}
                        <strong>{submissionSuccess.institutionName}</strong>, which already has active regulatory scrutiny
                        in the <strong>Regulation Bureau (RB)</strong>. The system has automatically mapped both cases for joint bureau monitoring.
                      </p>
                    </div>
                  </div>

                  {onNavigateToOverlap && (
                    <button
                      type="button"
                      onClick={onNavigateToOverlap}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded shadow-sm shrink-0 flex items-center space-x-1.5 transition"
                    >
                      <span>View Overlap Pair</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Receipt Particulars Body */}
              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded">
                  <div>
                    <span className="text-slate-500 block text-[11px]">External Portal Reference:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {submissionSuccess.externalRefId}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Source: {submissionSuccess.portalSource} Portal
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">AICTE Master Docket Generated:</span>
                    <span className="font-mono font-bold text-[#0b3b60] text-sm">
                      {submissionSuccess.internalComplaintNumber}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block">
                      Reflected in Real-Time
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Forwarded AICTE Bureau:</span>
                    <span className="font-bold text-slate-900">
                      Public Grievance Redressal Cell (PGRC)
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Under Process • SCSC Scrutiny Pool
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded text-blue-950 leading-relaxed">
                  <strong>Data Synchronization Confirmation:</strong> This grievance has been written to the authoritative AICTE complaint repository. Bureau officers in both PGRC and Regulation Bureau can now see this case on their master dashboard without any manual re-entry.
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold"
                    >
                      &larr; Lodge Another Grievance
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStatusRegNo(submissionSuccess.externalRefId);
                        setStatusCaptchaInput(generatedCaptcha);
                        setCpgramsView('status');
                        setSubmissionSuccess(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center space-x-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Track this Grievance Live &rarr;</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold flex items-center space-x-1"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Slip</span>
                    </button>

                    {onNavigateToDashboard && (
                      <button
                        type="button"
                        onClick={onNavigateToDashboard}
                        className="px-5 py-2 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold rounded shadow-sm flex items-center space-x-1.5 transition"
                      >
                        <span>View in All Complaints on AICTE Dash</span>
                        <ChevronRight className="w-4 h-4 text-amber-300" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            CPGRAMS PORTAL — Complete Working Replica of pgportal.gov.in
            ============================================================ */}
        {activePortal === 'cpgrams' && (
          <div className="bg-[#f5f5f5]">
            {/* 1. Top Government Utility Bar (Burgundy #6b0239) */}
            <div className="bg-[#6b0239] text-white py-1 px-4 border-b border-[#52002b] text-[11px]">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-1.5 font-sans">
                {/* Left: Official Government of India & Ministry Titles */}
                <div className="flex flex-wrap items-center space-x-2 text-white/90">
                  <span>भारत सरकार</span>
                  <span className="text-white/40">|</span>
                  <span className="font-semibold text-white">Government of India</span>
                  <span className="text-white/40 mx-1">|</span>
                  <span>कार्मिक, लोक शिकायत और पेंशन मंत्रालय</span>
                  <span className="text-white/40">|</span>
                  <span className="text-white/90">Ministry of Personnel, Public Grievances &amp; Pensions</span>
                </div>

                {/* Right: Quick Links */}
                <div className="flex items-center space-x-3 text-white/85 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCpgramsView('home');
                      setSubmissionSuccess(null);
                    }}
                    className="hover:text-amber-200 flex items-center space-x-1"
                  >
                    <span>🏠</span> <span>Home</span>
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={() => setShowContactModal(true)}
                    className="hover:text-amber-200 flex items-center space-x-1"
                  >
                    <span>📞</span> <span>Contact Us</span>
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCpgramsView('home');
                      setTimeout(() => {
                        const el = document.getElementById('about-cpgrams-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="hover:text-amber-200 flex items-center space-x-1"
                  >
                    <span>ℹ️</span> <span>About Us</span>
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={() => setShowCitizenCharterModal(true)}
                    className="hover:text-amber-200 flex items-center space-x-1"
                  >
                    <span>❓</span> <span>FAQs/Help</span>
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={() => alert('CPGRAMS Site Map:\n• Home (pgportal.gov.in)\n• Lodge Grievance / Pension\n• View Grievance / Appeal Status\n• Nodal PG Officers Directory\n• Redress Process Flow & Citizen Charter\n• Mobile App & UMANG Services')}
                    className="hover:text-amber-200 flex items-center space-x-1"
                  >
                    <span>🗺️</span> <span>Site Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Main White Branding Bar */}
            <div className="bg-white border-b border-slate-200 py-3.5 px-4 shadow-xs">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left: National Lion Emblem + Department of Administrative Reforms */}
                <div
                  className="flex items-center space-x-3.5 cursor-pointer"
                  onClick={() => {
                    setCpgramsView('home');
                    setSubmissionSuccess(null);
                  }}
                >
                  <div className="w-12 h-14 shrink-0 flex items-center justify-center">
                    <img
                      src="/aicte-emblem.png"
                      alt="National Emblem"
                      className="w-11 h-13 object-contain drop-shadow-xs"
                    />
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-800 font-medium leading-tight">
                      प्रशासनिक सुधार और लोक शिकायत विभाग
                    </div>
                    <div className="text-[#870044] font-extrabold text-sm sm:text-base tracking-wide uppercase leading-tight mt-0.5">
                      DEPARTMENT OF
                    </div>
                    <div className="text-[#0d3b66] font-black text-base sm:text-lg tracking-wider uppercase leading-none">
                      ADMINISTRATIVE REFORMS &amp; PUBLIC GRIEVANCES
                    </div>
                  </div>
                </div>

                {/* Right: Navy CPGRAMS Badge */}
                <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
                  <div className="bg-[#002f5e] text-white px-5 py-1 rounded font-extrabold text-xl tracking-widest shadow-xs">
                    CPGRAMS
                  </div>
                  <div className="text-[11px] text-slate-700 font-medium tracking-tight mt-1">
                    Centralized Public Grievance Redress And Monitoring System
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Primary Burgundy Navigation Menu Bar with Working Dropdowns */}
            <div className="bg-[#6b0239] text-white shadow-sm border-t border-[#800345] relative z-30">
              <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between text-xs font-semibold">
                {/* Left Navigation Buttons with Working Dropdowns */}
                <div className="flex flex-wrap items-center relative">
                  {/* View Status Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'view_status' ? null : 'view_status');
                      }}
                      className={`py-2.5 px-3 flex items-center space-x-1.5 transition border-r border-[#850448]/60 ${
                        activeDropdown === 'view_status' || cpgramsView === 'status'
                          ? 'bg-[#850448] text-amber-200'
                          : 'hover:bg-[#850448]'
                      }`}
                    >
                      <span>🔍</span>
                      <span>View Status</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    {activeDropdown === 'view_status' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full mt-0.5 w-56 bg-white text-slate-800 rounded shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setStatusTab('grievance');
                            setCpgramsView('status');
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2 border-b border-slate-100"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>View Status of Grievance</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusTab('appeal');
                            setCpgramsView('status');
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>View Status of Appeal</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nodal PG Officers Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'nodal_officers' ? null : 'nodal_officers');
                      }}
                      className={`py-2.5 px-3 flex items-center space-x-1.5 transition border-r border-[#850448]/60 ${
                        activeDropdown === 'nodal_officers' ? 'bg-[#850448] text-amber-200' : 'hover:bg-[#850448]'
                      }`}
                    >
                      <span>👤</span>
                      <span>Nodal PG Officers</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    {activeDropdown === 'nodal_officers' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full mt-0.5 w-56 bg-white text-slate-800 rounded shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowNodalOfficersModal('central');
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2 border-b border-slate-100"
                        >
                          <Building2 className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Central Government</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNodalOfficersModal('state');
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2"
                        >
                          <Building2 className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>State Government</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Redress Process Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'redress_process' ? null : 'redress_process');
                      }}
                      className={`py-2.5 px-3 flex items-center space-x-1.5 transition border-r border-[#850448]/60 ${
                        activeDropdown === 'redress_process' ? 'bg-[#850448] text-amber-200' : 'hover:bg-[#850448]'
                      }`}
                    >
                      <span>🏛️</span>
                      <span>Redress Process</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    {activeDropdown === 'redress_process' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full mt-0.5 w-60 bg-white text-slate-800 rounded shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowRedressFlowModal(true);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2 border-b border-slate-100"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Redress Process Flow</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCitizenCharterModal(true);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2"
                        >
                          <Info className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Citizen Charter</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Grievance Dropdown (CRITICAL FUNCTIONALITY) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'grievance' ? null : 'grievance');
                      }}
                      className={`py-2.5 px-3.5 flex items-center space-x-1.5 border-r border-[#850448]/60 transition ${
                        activeDropdown === 'grievance' || cpgramsView === 'lodge_public'
                          ? 'bg-[#850448] text-amber-200 border-b-2 border-amber-300'
                          : 'hover:bg-[#850448]'
                      }`}
                    >
                      <span>📋</span>
                      <span>Grievance</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                    {activeDropdown === 'grievance' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 top-full mt-0.5 w-64 bg-white text-slate-800 rounded shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setCpgramsView('lodge_public');
                            setSubmissionSuccess(null);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-orange-50 hover:text-[#870044] font-bold flex items-center space-x-2 border-b border-slate-100 text-[#002f5e]"
                        >
                          <Send className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Lodge Public Grievance</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPensionModal(true);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2 border-b border-slate-100"
                        >
                          <User className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Lodge Pension Grievance</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReminderModal(true);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2 border-b border-slate-100"
                        >
                          <Clock className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Send Reminder / Clarification</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAppealModal(true);
                            setActiveDropdown(null);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-orange-50 hover:text-[#870044] font-medium flex items-center space-x-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6b0239]" />
                          <span>Rate Grievance / Appeal</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nodal Authority for Appeal */}
                  <button
                    type="button"
                    onClick={() => setShowNodalAuthorityAppealModal(true)}
                    className="py-2.5 px-3 hover:bg-[#850448] flex items-center space-x-1.5 transition border-r border-[#850448]/60 hidden md:flex"
                  >
                    <span>👥</span>
                    <span>Nodal Authority for Appeal</span>
                  </button>

                  {/* Mobile App */}
                  <button
                    type="button"
                    onClick={() => setShowMobileAppModal(true)}
                    className="py-2.5 px-3 hover:bg-[#850448] flex items-center space-x-1.5 transition border-r border-[#850448]/60 hidden sm:flex"
                  >
                    <span>📱</span>
                    <span>Mobile App</span>
                  </button>
                </div>

                {/* Right: Language Selector + Sign In Button */}
                <div className="flex items-center space-x-2 py-1.5">
                  <span className="text-[11px] text-white/90">Language :</span>
                  <select className="bg-white text-slate-800 text-[11px] font-medium py-1 px-2 rounded border border-slate-300 focus:outline-none">
                    <option value="en">English</option>
                    <option value="hi">हिन्दी</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowSignInModal(true)}
                    className="bg-[#f2a900] hover:bg-[#dba100] text-slate-900 font-bold text-xs py-1 px-3 rounded shadow-xs flex items-center space-x-1 transition ml-1"
                  >
                    <span>➜]</span>
                    <span>Sign In</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Yellow Hero Banner (Always shown at top of CPGRAMS) */}
            <div className="relative bg-gradient-to-r from-[#ffe433] via-[#ffdf00] to-[#fec810] border-b-2 border-amber-400 py-8 px-4 overflow-hidden shadow-inner">
              <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                {/* Left Hero Pitch */}
                <div className="space-y-2 text-center md:text-left max-w-xl">
                  <div className="text-red-700 font-extrabold text-2xl sm:text-3xl tracking-tight">
                    Redress Process Flow
                  </div>
                  <h1 className="text-slate-900 font-black text-2xl sm:text-4xl tracking-tight">
                    Citizen Lodges Complaint
                  </h1>
                  <p className="text-slate-800 font-bold text-xs sm:text-sm uppercase tracking-wide pt-2">
                    ARE YOU AGGRIEVED WITH THE SERVICES OF GOVERNMENT AGENCY?
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCpgramsView('lodge_public');
                        setSubmissionSuccess(null);
                      }}
                      className="inline-block bg-[#002f5e] hover:bg-[#002040] text-white font-extrabold text-sm sm:text-base px-6 py-2.5 rounded shadow-md tracking-wider uppercase transition cursor-pointer"
                    >
                      LODGE YOUR GRIEVANCE HERE
                    </button>
                  </div>
                </div>

                {/* Right: 3 Hexagonal Step Cards (01 COMPLAINT LODGE, 02 ASSESSMENT, 03 REDRESSAL) */}
                <div className="flex items-center space-x-3 sm:space-x-4">
                  {/* Step 1 */}
                  <div
                    onClick={() => setCpgramsView('lodge_public')}
                    className="bg-white rounded-lg shadow-md border-2 border-sky-400 p-3 sm:p-4 text-center w-28 sm:w-32 transition hover:scale-105 cursor-pointer"
                  >
                    <div className="w-8 h-8 mx-auto bg-sky-500 text-white rounded-full flex items-center justify-center font-extrabold text-xs shadow-xs mb-1.5">
                      01
                    </div>
                    <div className="text-[11px] sm:text-xs font-black text-slate-800 uppercase leading-tight">
                      COMPLAINT LODGE
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Portal Entry</div>
                  </div>

                  {/* Step 2 */}
                  <div
                    onClick={() => setShowRedressFlowModal(true)}
                    className="bg-white rounded-lg shadow-md border-2 border-indigo-400 p-3 sm:p-4 text-center w-28 sm:w-32 transition hover:scale-105 cursor-pointer"
                  >
                    <div className="w-8 h-8 mx-auto bg-indigo-600 text-white rounded-full flex items-center justify-center font-extrabold text-xs shadow-xs mb-1.5">
                      02
                    </div>
                    <div className="text-[11px] sm:text-xs font-black text-slate-800 uppercase leading-tight">
                      ASSESSMENT
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Nodal Officer</div>
                  </div>

                  {/* Step 3 */}
                  <div
                    onClick={() => setCpgramsView('status')}
                    className="bg-white rounded-lg shadow-md border-2 border-rose-400 p-3 sm:p-4 text-center w-28 sm:w-32 transition hover:scale-105 cursor-pointer"
                  >
                    <div className="w-8 h-8 mx-auto bg-rose-600 text-white rounded-full flex items-center justify-center font-extrabold text-xs shadow-xs mb-1.5">
                      03
                    </div>
                    <div className="text-[11px] sm:text-xs font-black text-slate-800 uppercase leading-tight">
                      REDRESSAL
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Final Disposal</div>
                  </div>
                </div>
              </div>

              {/* Sub-label under Hero */}
              <div className="max-w-6xl mx-auto mt-4 text-right">
                <span className="text-[#002f5e] font-extrabold text-xs sm:text-sm tracking-wide bg-white/70 px-3 py-1 rounded">
                  Redirection to Concerned Authority &rarr;
                </span>
              </div>
            </div>

            {/* 5. Warning Notice Ribbon */}
            <div className="bg-[#52002b] text-white py-2 px-4 text-center text-xs font-medium border-b border-[#6e023b]">
              <span>⚠️ Any Grievance sent by email will not be attended to / entertained. Please lodge your grievance on this portal.</span>
            </div>

            {/* =========================================================
                VIEW A: HOMEPAGE VIEW (Initial State, matches Screenshot 2)
                ========================================================= */}
            {cpgramsView === 'home' && (
              <div id="about-cpgrams-section" className="max-w-7xl mx-auto px-4 py-8">
                {/* 2-Column Section: ABOUT CPGRAMS (Left) & WHAT'S NEW (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                  {/* Left Column: ABOUT CPGRAMS (~65%) */}
                  <div className="lg:col-span-8 bg-white border border-slate-300 rounded p-6 shadow-sm text-slate-800 space-y-4">
                    <h2 className="text-[#6b0239] font-black text-lg border-b-2 border-[#6b0239] pb-2 uppercase tracking-wide">
                      ABOUT CPGRAMS
                    </h2>

                    <p className="text-xs text-justify leading-relaxed text-slate-700">
                      Centralised Public Grievance Redress and Monitoring System (CPGRAMS) is an online platform available to the citizens 24x7 to lodge their grievances to the public authorities on any subject related to service delivery. It is a single portal connected to all the Ministries/Departments of Government of India and States. Every Ministry and States have role-based access to this system. CPGRAMS is also accessible to the citizens through standalone mobile application downloadable through Google Play store and mobile application integrated with UMANG.
                    </p>

                    <p className="text-xs text-justify leading-relaxed text-slate-700">
                      The status of the grievance filed in CPGRAMS can be tracked with the unique registration ID provided at the time of registration of the complainant. CPGRAMS also provides appeal facility to the citizens if they are not satisfied with the resolution by the Grievance Officer. After closure of grievance if the complainant is not satisfied with the resolution, he/she can provide feedback. If the rating is 'Poor' the option to file an appeal is enabled. The status of the Appeal can also be tracked by the petitioner with the grievance registration number.
                    </p>

                    {/* Issues which are not taken up for redress */}
                    <div className="bg-amber-50/70 border border-amber-200 rounded p-3 text-xs">
                      <div className="font-bold text-red-900 mb-2">
                        Issues which are not taken up for redress :
                      </div>
                      <ul className="space-y-1 text-slate-700 pl-1 text-[11px]">
                        <li className="flex items-start space-x-1.5">
                          <span className="text-[#6b0239] font-bold">▸</span>
                          <span>RTI Matters</span>
                        </li>
                        <li className="flex items-start space-x-1.5">
                          <span className="text-[#6b0239] font-bold">▸</span>
                          <span>Court related / Subjudice matters</span>
                        </li>
                        <li className="flex items-start space-x-1.5">
                          <span className="text-[#6b0239] font-bold">▸</span>
                          <span>Religious matters</span>
                        </li>
                        <li className="flex items-start space-x-1.5">
                          <span className="text-[#6b0239] font-bold">▸</span>
                          <span>
                            Grievances of Government employees concerning their service matters including disciplinary proceedings etc. unless the aggrieved employee has already exhausted the prescribed channels keeping in view the DoPT OM No. 11013/08/2013-Estt.(A-III) dated 31.08.2015
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Note Box */}
                    <div className="text-[11px] text-slate-600 space-y-1.5 border-t border-slate-200 pt-3">
                      <div className="font-bold text-slate-800">Note :</div>
                      <p>
                        1. If you have not got a satisfactory redress of your grievance within a reasonable period of time,relating to Ministries/Departments and Organisations under the purview of Directorate of Public Grievances(DPG), Cabinet Secretariat, GOI, you may seek help of DPG in resolution.{' '}
                        <button
                          type="button"
                          onClick={() => alert('Directorate of Public Grievances (DPG), Cabinet Secretariat, GOI: dpg.gov.in')}
                          className="text-blue-700 underline font-semibold"
                        >
                          Please click here for details.
                        </button>
                      </p>
                      <p>
                        2. Government is not charging fee from the public for filing grievances. All money being paid by the public for filing grievance is going only to M/s CSC only
                      </p>
                    </div>
                  </div>

                  {/* Right Column: WHAT'S NEW (~35%) */}
                  <div className="lg:col-span-4 bg-white border border-slate-300 rounded p-5 shadow-sm space-y-4">
                    <h2 className="text-[#6b0239] font-black text-base border-b-2 border-[#6b0239] pb-2 uppercase tracking-wide flex items-center justify-between">
                      <span>WHAT'S NEW</span>
                      <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded animate-pulse">
                        LIVE
                      </span>
                    </h2>

                    <div className="space-y-3.5">
                      {/* Notice Card 1 */}
                      <div className="border border-slate-200 rounded p-3 hover:bg-slate-50 transition">
                        <div className="flex items-center space-x-2 text-[10px] font-bold text-rose-700 uppercase">
                          <span className="px-1.5 py-0.5 bg-rose-100 rounded">27 JULY 2022</span>
                          <span>• OM NOTIFICATION</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1">
                          Strengthening of Machinery for Redressal of Public Grievance (CPGRAMS)
                        </h4>
                        <div className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center space-x-1 cursor-pointer">
                          <Download className="w-3 h-3" />
                          <span>Download Office Memorandum (PDF - 1.05 MB)</span>
                        </div>
                      </div>

                      {/* Notice Card 2 */}
                      <div className="border border-slate-200 rounded p-3 hover:bg-slate-50 transition">
                        <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-700 uppercase">
                          <span className="px-1.5 py-0.5 bg-emerald-100 rounded">23 AUGUST 2024</span>
                          <span>• COMPREHENSIVE POLICY</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1">
                          Comprehensive Guidelines for Handling the Public Grievances
                        </h4>
                        <div className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center space-x-1 cursor-pointer">
                          <Download className="w-3 h-3" />
                          <span>Download Guidelines (PDF - 0.25 MB)</span>
                        </div>
                      </div>

                      {/* Notice Card 3 (AICTE Integration SIH) */}
                      <div className="border-2 border-dashed border-orange-300 bg-orange-50/70 rounded p-3">
                        <div className="flex items-center space-x-1.5 text-[10px] font-bold text-orange-900 uppercase">
                          <Sparkles className="w-3 h-3 text-orange-600" />
                          <span>SIH-26264 REAL-TIME PIPELINE</span>
                        </div>
                        <h4 className="text-xs font-bold text-orange-950 mt-1">
                          AICTE-Samadhan Automated Docketing &amp; Cross-Bureau Overlap Engine
                        </h4>
                        <p className="text-[11px] text-orange-800 mt-1">
                          Public grievances regarding AICTE technical institutes submitted here are automatically routed to PGRC and mapped against Regulation Bureau inquiries.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Large Action Cards (Matches Screenshot 2 Exactly) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {/* Card 1: Blue - REGISTER / LOGIN */}
                  <div className="bg-[#1b75bb] text-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition transform hover:-translate-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider text-blue-100 font-semibold">
                          Citizen Services
                        </div>
                        <h3 className="text-xl font-bold">Register / Login</h3>
                        <p className="text-xs text-blue-100 mt-2 leading-relaxed">
                          Create an account or sign in to lodge public grievances, submit appeals, and track redressal history.
                        </p>
                      </div>
                      <div className="p-3 bg-white/15 rounded-full shrink-0 ml-3">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setShowSignInModal(true)}
                        className="w-full bg-white hover:bg-slate-100 text-[#1b75bb] font-extrabold text-xs py-2.5 px-4 rounded shadow-xs uppercase tracking-wider transition"
                      >
                        REGISTER / LOGIN
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Pink/Red - VIEW STATUS */}
                  <div className="bg-[#d9534f] text-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition transform hover:-translate-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider text-rose-100 font-semibold">
                          Live Tracking
                        </div>
                        <h3 className="text-xl font-bold">View Status</h3>
                        <p className="text-xs text-rose-100 mt-2 leading-relaxed">
                          Track real-time movement and action taken report (ATR) of your registered grievance or second appeal.
                        </p>
                      </div>
                      <div className="p-3 bg-white/15 rounded-full shrink-0 ml-3">
                        <Search className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setCpgramsView('status')}
                        className="w-full bg-white hover:bg-slate-100 text-[#d9534f] font-extrabold text-xs py-2.5 px-4 rounded shadow-xs uppercase tracking-wider transition"
                      >
                        VIEW STATUS
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Peach/Orange - CONTACT US */}
                  <div className="bg-[#f0ad4e] text-slate-900 rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition transform hover:-translate-y-0.5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider text-amber-950 font-bold">
                          Citizen Support
                        </div>
                        <h3 className="text-xl font-black text-amber-950">Contact Us</h3>
                        <p className="text-xs text-amber-900 mt-2 leading-relaxed">
                          Reach Nodal Grievance Officers, DARPG Headquarters, and National Toll-Free Helpline: 1800-425-0012.
                        </p>
                      </div>
                      <div className="p-3 bg-black/10 rounded-full shrink-0 ml-3">
                        <Phone className="w-8 h-8 text-amber-950" />
                      </div>
                    </div>
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setShowContactModal(true)}
                        className="w-full bg-[#002f5e] hover:bg-[#002040] text-white font-extrabold text-xs py-2.5 px-4 rounded shadow-xs uppercase tracking-wider transition"
                      >
                        CONTACT US
                      </button>
                    </div>
                  </div>
                </div>

                {/* Social Share & Connect Bar */}
                <div className="flex items-center justify-center space-x-4 py-4 border-y border-slate-300 text-slate-600 text-xs font-semibold">
                  <span>Connect with CPGRAMS:</span>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:text-blue-800">
                    📘 Facebook
                  </a>
                  <span>•</span>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-sky-500 hover:text-sky-700">
                    🐦 X (Twitter)
                  </a>
                  <span>•</span>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-red-600 hover:text-red-800">
                    ▶️ YouTube
                  </a>
                </div>
              </div>
            )}

            {/* =========================================================
                VIEW B: GRIEVANCE INTAKE FORM (cpgramsView === 'lodge_public')
                ========================================================= */}
            {cpgramsView === 'lodge_public' && (
              <div>
                {/* Breadcrumb Navigation */}
                <div className="bg-slate-200/70 border-b border-slate-300 py-2 px-4 text-xs">
                  <div className="max-w-7xl mx-auto flex items-center space-x-2 text-slate-600">
                    <button
                      type="button"
                      onClick={() => setCpgramsView('home')}
                      className="hover:text-[#6b0239] font-semibold flex items-center space-x-1"
                    >
                      <span>Home</span>
                    </button>
                    <span>&gt;</span>
                    <span>Grievance</span>
                    <span>&gt;</span>
                    <span className="font-bold text-[#6b0239]">Lodge Public Grievance</span>
                  </div>
                </div>

                {/* Two-Column Form Layout */}
                <div className="max-w-7xl mx-auto px-4 py-6">
                  <div className="flex flex-col lg:flex-row gap-5">
                    {/* Left Sidebar (~30%) */}
                    <aside className="lg:w-[30%] space-y-4">
                      {/* Important Instructions */}
                      <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
                        <div className="bg-[#003366] text-white py-2.5 px-4">
                          <h3 className="font-bold text-sm">
                            Important Instructions <span className="text-blue-200 font-normal text-xs">(सूचना)</span>
                          </h3>
                        </div>
                        <ul className="p-4 space-y-2.5 text-[12px] text-gray-700">
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Before filing a grievance, check if the matter has already been addressed or is sub-judice.</span>
                          </li>
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Grievances should pertain to matters within the purview of the Central Government.</span>
                          </li>
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Upload supporting documents in <strong>PDF format only</strong> (maximum 2MB per file).</span>
                          </li>
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Note your registration number carefully for future tracking and reminders.</span>
                          </li>
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Lodge only one grievance per registration to ensure proper redressal.</span>
                          </li>
                          <li className="flex items-start space-x-2">
                            <span className="text-[#f47920] mt-0.5 shrink-0">▸</span>
                            <span>Anonymous or vague grievances without supporting facts may not be entertained.</span>
                          </li>
                        </ul>
                      </div>

                      {/* Contact Information */}
                      <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
                        <div className="bg-[#003366] text-white py-2.5 px-4">
                          <h3 className="font-bold text-sm">Contact Information</h3>
                        </div>
                        <div className="p-4 text-[12px] text-gray-700 space-y-2">
                          <div className="font-semibold text-gray-900">
                            DARPG – Department of Administrative Reforms &amp; Public Grievances
                          </div>
                          <div>Public Redress Division, CGO Complex, New Delhi – 110 003</div>
                          <div className="flex items-center space-x-1.5 mt-1">
                            <Phone className="w-3 h-3 text-[#003366]" />
                            <span>011-20984120</span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            <Mail className="w-3 h-3 text-[#003366]" />
                            <span>helpdesk-pgportal@gov.in</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500">
                            Working Hours: Mon–Fri, 9:00 AM – 5:30 PM
                          </div>
                        </div>
                      </div>

                      {/* Helpline */}
                      <div className="bg-orange-50 border border-orange-200 rounded p-3 text-[12px]">
                        <div className="font-bold text-[#003366] mb-1">📞 CPGRAMS Helpline</div>
                        <div className="text-gray-700">
                          Toll Free: <strong className="text-[#003366]">1800-425-0012</strong>
                        </div>
                        <div className="text-gray-600 text-[11px] mt-1">
                          Monday to Saturday (except national holidays) 9 AM – 8 PM
                        </div>
                      </div>
                    </aside>

                    {/* Right Main Form Area (~70%) */}
                    <div className="lg:flex-1">
                      <div className="bg-white border border-gray-300 rounded shadow-sm overflow-hidden">
                        {/* Form Title */}
                        <div className="bg-[#003366] text-white py-3 px-5 flex items-center justify-between">
                          <h2 className="font-bold text-base">Lodge Public Grievance</h2>
                          <span className="text-blue-200 text-[11px]">
                            Fields marked <span className="text-red-300 font-bold">*</span> are mandatory
                          </span>
                        </div>
                        <div className="h-1 bg-[#f47920]"></div>

                        <form onSubmit={handleIntakeSubmit} className="p-5 space-y-6">
                          {/* Section 1 – Personal Details */}
                          <div>
                            <div className="flex items-center space-x-2 mb-4 pb-2 border-b-2 border-[#003366]">
                              <span className="bg-[#003366] text-white text-xs font-bold px-2.5 py-1 rounded">1</span>
                              <h3 className="font-bold text-[#003366] text-sm uppercase tracking-wide">
                                Personal Details
                              </h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={complainantName}
                                  onChange={(e) => setComplainantName(e.target.value)}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label>
                                <select className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]">
                                  <option value="M">Male</option>
                                  <option value="F">Female</option>
                                  <option value="O">Other / Prefer not to say</option>
                                </select>
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                                <textarea
                                  rows={2}
                                  placeholder="House / Flat No., Street, Area, City"
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">Pin Code</label>
                                <input
                                  type="text"
                                  placeholder="6-digit PIN"
                                  maxLength={6}
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  State / UT <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={stateName}
                                  onChange={(e) => setStateName(e.target.value)}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Mobile Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="tel"
                                  value={complainantPhone}
                                  onChange={(e) => setComplainantPhone(e.target.value)}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Email ID <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="email"
                                  value={complainantEmail}
                                  onChange={(e) => setComplainantEmail(e.target.value)}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Section 2 – Grievance Details */}
                          <div>
                            <div className="flex items-center space-x-2 mb-4 pb-2 border-b-2 border-[#003366]">
                              <span className="bg-[#003366] text-white text-xs font-bold px-2.5 py-1 rounded">2</span>
                              <h3 className="font-bold text-[#003366] text-sm uppercase tracking-wide">
                                Grievance Details
                              </h3>
                            </div>

                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Ministry / Department <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value="Ministry of Education"
                                    disabled
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-gray-100 cursor-not-allowed"
                                  />
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Organisation / Sub-organisation <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value="All India Council for Technical Education (AICTE)"
                                    disabled
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 bg-gray-100 cursor-not-allowed"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Grievance Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={category}
                                  onChange={(e) => setCategory(e.target.value)}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                >
                                  <option value="Fee Cap Violation">Fee Cap Violation</option>
                                  <option value="Faculty Deficiency & Non-Payment of Remuneration">
                                    Faculty Deficiency &amp; Non-Payment of Remuneration
                                  </option>
                                  <option value="Withholding of Original Certificates">
                                    Withholding of Original Certificates
                                  </option>
                                  <option value="Ragging & Student Harassment">
                                    Ragging &amp; Student Harassment
                                  </option>
                                  <option value="Infrastructure & Lab Non-Compliance">
                                    Infrastructure &amp; Lab Non-Compliance
                                  </option>
                                  <option value="Unauthorized Course Operation">
                                    Unauthorized Course Operation
                                  </option>
                                  <option value="Admission Irregularity">Admission Irregularity</option>
                                  <option value="Other">Other Technical Education Matters</option>
                                </select>
                              </div>

                              {/* Institution Selection Dropdown */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Technical Institution Concerned <span className="text-red-500">*</span>
                                </label>
                                <select
                                  value={selectedInstId}
                                  onChange={(e) => {
                                    setSelectedInstId(e.target.value);
                                    const sel = institutions.find((i) => i.id === e.target.value);
                                    if (sel) {
                                      setStateName(sel.state);
                                    }
                                  }}
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] cursor-pointer"
                                >
                                  <option value="">-- Select Technical Institution --</option>
                                  {institutions.map((inst) => (
                                    <option key={inst.id} value={inst.id}>
                                      {inst.institution_name} [{inst.aicte_permanent_id || 'ID Pending'}] — {inst.state}
                                    </option>
                                  ))}
                                </select>
                                {selectedInstitution && (
                                  <div className="mt-1.5 p-2.5 bg-blue-50 border border-blue-200 rounded text-xs flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <span className="font-bold text-gray-900">
                                        {selectedInstitution.institution_name}
                                      </span>
                                      <span className="text-gray-500 text-[11px] block">
                                        AICTE ID: <strong className="font-mono">{selectedInstitution.aicte_permanent_id || 'N/A'}</strong> • {selectedInstitution.state}
                                      </span>
                                    </div>
                                    {selectedInstitution.id === 'a0000000-0000-0000-0000-000000000001' && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px] uppercase">
                                        Active RB Case Recorded
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Grievance Subject <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={subject}
                                  onChange={(e) => setSubject(e.target.value)}
                                  placeholder="Brief subject of your grievance"
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366]"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                                  <span>Grievance Description <span className="text-red-500">*</span></span>
                                  <span className="text-[11px] text-gray-400 font-normal">{description.length}/3000</span>
                                </label>
                                <textarea
                                  rows={6}
                                  value={description}
                                  onChange={(e) => setDescription(e.target.value.slice(0, 3000))}
                                  placeholder="Please describe your grievance clearly. Include relevant dates, reference numbers, and the relief sought. (Max 3000 characters)"
                                  required
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] resize-none"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                  Upload Supporting Document <span className="text-gray-400 font-normal">(Optional, PDF only, max 2MB)</span>
                                </label>
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="w-full border border-gray-400 rounded px-3 py-2 text-sm text-gray-700 bg-white file:mr-3 file:py-1 file:px-3 file:border file:border-gray-300 file:rounded file:text-xs file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Section 3 – OTP Verification */}
                          <div>
                            <div className="flex items-center space-x-2 mb-4 pb-2 border-b-2 border-[#003366]">
                              <span className="bg-[#003366] text-white text-xs font-bold px-2.5 py-1 rounded">3</span>
                              <h3 className="font-bold text-[#003366] text-sm uppercase tracking-wide">
                                OTP Verification
                              </h3>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded p-4">
                              <p className="text-xs text-gray-700 mb-3">
                                An OTP will be sent to your registered mobile number <strong>{complainantPhone}</strong> for identity verification.
                              </p>
                              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                                <div className="flex-1">
                                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Enter OTP
                                  </label>
                                  <input
                                    type="text"
                                    value={otpValue}
                                    onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Enter 6-digit OTP"
                                    maxLength={6}
                                    disabled={!otpSent}
                                    className="w-full border border-gray-400 rounded px-3 py-2 text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#003366] font-mono tracking-widest text-center disabled:bg-gray-100 disabled:cursor-not-allowed"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => { setOtpSent(true); setOtpValue('123456'); }}
                                  className="px-4 py-2 bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold rounded transition shrink-0"
                                >
                                  {otpSent ? 'Resend OTP' : 'Send OTP'}
                                </button>
                              </div>
                              {otpSent && (
                                <p className="text-[11px] text-green-700 mt-2 font-semibold">
                                  ✓ OTP sent successfully to {complainantPhone} (Verification OTP: 123456)
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Submit + Reset */}
                          <div className="pt-2 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <p className="text-[11px] text-gray-500">
                              By submitting, I declare the above information is true and correct to the best of my knowledge.
                            </p>
                            <div className="flex items-center space-x-3">
                              <button
                                type="button"
                                onClick={handleReset}
                                className="px-5 py-2.5 border border-gray-400 hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded transition"
                              >
                                Reset
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-7 py-2.5 bg-[#f47920] hover:bg-[#e06510] text-white text-sm font-bold rounded shadow-md flex items-center space-x-2 transition"
                              >
                                {isSubmitting ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Submitting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-4 h-4" />
                                    <span>Submit Grievance</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                VIEW C: VIEW STATUS VIEW (cpgramsView === 'status')
                ========================================================= */}
            {cpgramsView === 'status' && (
              <div>
                {/* Breadcrumb Navigation */}
                <div className="bg-slate-200/70 border-b border-slate-300 py-2 px-4 text-xs">
                  <div className="max-w-7xl mx-auto flex items-center space-x-2 text-slate-600">
                    <button
                      type="button"
                      onClick={() => setCpgramsView('home')}
                      className="hover:text-[#6b0239] font-semibold flex items-center space-x-1"
                    >
                      <span>Home</span>
                    </button>
                    <span>&gt;</span>
                    <span>View Status</span>
                    <span>&gt;</span>
                    <span className="font-bold text-[#6b0239]">
                      {statusTab === 'grievance' ? 'Track Grievance Status' : 'Track Appeal Status'}
                    </span>
                  </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-8">
                  {/* Status Query Card */}
                  <div className="bg-white border border-slate-300 rounded shadow-md overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Search className="w-5 h-5 text-amber-300" />
                        <h2 className="text-base font-bold">
                          {statusTab === 'grievance' ? 'View Status of Public Grievance' : 'View Status of Grievance Appeal'}
                        </h2>
                      </div>
                      <div className="flex bg-[#52002b] rounded p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setStatusTab('grievance')}
                          className={`px-3 py-1 rounded transition ${
                            statusTab === 'grievance' ? 'bg-[#f2a900] text-slate-900' : 'text-white hover:text-amber-200'
                          }`}
                        >
                          Grievance
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTab('appeal')}
                          className={`px-3 py-1 rounded transition ${
                            statusTab === 'appeal' ? 'bg-[#f2a900] text-slate-900' : 'text-white hover:text-amber-200'
                          }`}
                        >
                          Appeal
                        </button>
                      </div>
                    </div>

                    {/* Quick Demo Pre-fill for Hackathon Evaluators */}
                    <div className="bg-orange-50 border-b border-orange-200 p-3 px-6 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 text-orange-950">
                        <Sparkles className="w-4 h-4 text-orange-600" />
                        <span className="font-bold">Instant Demo Tracking:</span>
                        <span className="text-orange-800">Click a test registration number below to populate:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {streamHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setStatusRegNo(streamHistory[0].externalReferenceId);
                              setStatusCaptchaInput(generatedCaptcha);
                            }}
                            className="px-2.5 py-1 bg-white border border-orange-300 hover:bg-orange-100 rounded text-[11px] font-mono font-bold text-[#002f5e]"
                          >
                            Latest Submitted: {streamHistory[0].externalReferenceId}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setStatusRegNo('DARPG/E/2026/01492');
                            setStatusCaptchaInput(generatedCaptcha);
                          }}
                          className="px-2.5 py-1 bg-white border border-orange-300 hover:bg-orange-100 rounded text-[11px] font-mono text-slate-700"
                        >
                          DARPG/E/2026/01492
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusRegNo('DARPG/E/2026/03810');
                            setStatusCaptchaInput(generatedCaptcha);
                          }}
                          className="px-2.5 py-1 bg-white border border-orange-300 hover:bg-orange-100 rounded text-[11px] font-mono text-slate-700"
                        >
                          DARPG/E/2026/03810
                        </button>
                      </div>
                    </div>

                    {/* Search Form */}
                    <form onSubmit={handleStatusSearch} className="p-6 space-y-4">
                      {statusSearchError && (
                        <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded text-xs flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>{statusSearchError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Registration Number <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={statusRegNo}
                            onChange={(e) => setStatusRegNo(e.target.value)}
                            placeholder="e.g. DARPG/E/2026/01492"
                            required
                            className="w-full border border-slate-400 rounded px-3 py-2 text-sm font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#6b0239]"
                          />
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Enter the unique registration ID received via SMS/Email
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mobile Number / Email ID <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={statusPhoneOrEmail}
                            onChange={(e) => setStatusPhoneOrEmail(e.target.value)}
                            placeholder="Enter registered mobile or email"
                            className="w-full border border-slate-400 rounded px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#6b0239]"
                          />
                        </div>
                      </div>

                      {/* Captcha Section */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex items-center space-x-2">
                          <div className="bg-slate-800 text-amber-300 tracking-widest font-mono font-bold text-lg px-4 py-2 rounded select-none shadow-inner border border-slate-700">
                            {generatedCaptcha}
                          </div>
                          <button
                            type="button"
                            onClick={refreshCaptcha}
                            title="Refresh Security Code"
                            className="p-2 border border-slate-300 hover:bg-white rounded text-slate-600 hover:text-slate-900"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Security Code (Captcha) <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={statusCaptchaInput}
                            onChange={(e) => setStatusCaptchaInput(e.target.value)}
                            placeholder="Enter characters shown above"
                            required
                            className="w-full border border-slate-400 rounded px-3 py-2 text-sm font-mono uppercase text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#6b0239]"
                          />
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusRegNo('');
                            setStatusPhoneOrEmail('');
                            setStatusCaptchaInput('');
                            setSearchedStatusResult(null);
                            setStatusSearchError(null);
                            refreshCaptcha();
                          }}
                          className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold"
                        >
                          Reset
                        </button>
                        <button
                          type="submit"
                          className="px-6 py-2 bg-[#6b0239] hover:bg-[#52002b] text-white rounded text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Submit &amp; View Status</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Search Result Dossier */}
                  {searchedStatusResult && (
                    <div className="mt-6 bg-white border border-slate-300 rounded shadow-lg overflow-hidden animate-in fade-in duration-200">
                      <div className="bg-[#002f5e] text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-amber-200 font-bold uppercase tracking-wider">
                            Grievance Redressal Status Slip
                          </div>
                          <h3 className="text-base font-bold font-mono">
                            Registration No: {searchedStatusResult.regNo}
                          </h3>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-200 border border-emerald-400 rounded text-xs font-bold uppercase">
                          {searchedStatusResult.currentStatus}
                        </span>
                      </div>

                      <div className="p-5 space-y-4 text-xs">
                        {/* Meta Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Subject / Title:</span>
                            <span className="font-semibold text-slate-900">{searchedStatusResult.subject}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Institution Concerned:</span>
                            <span className="font-semibold text-slate-900">{searchedStatusResult.institution}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Category:</span>
                            <span className="font-semibold text-slate-900">{searchedStatusResult.category}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Date of Receipt:</span>
                            <span className="font-semibold text-slate-900">{searchedStatusResult.date}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Public Grievance Officer:</span>
                            <span className="font-semibold text-slate-900">{searchedStatusResult.officer}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Officer Contact:</span>
                            <span className="font-semibold text-slate-900 font-mono text-[11px]">
                              {searchedStatusResult.officerContact}
                            </span>
                          </div>
                        </div>

                        {/* Movement History Table */}
                        <div>
                          <h4 className="text-xs font-bold text-[#6b0239] uppercase tracking-wider mb-2">
                            Chronological Case Movement &amp; Action Taken
                          </h4>
                          <div className="border border-slate-200 rounded overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Date &amp; Time</th>
                                  <th className="p-2.5">Action Taken</th>
                                  <th className="p-2.5">Action Taken By / Office</th>
                                  <th className="p-2.5">Remarks / Direction</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {searchedStatusResult.movements.map((m, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                      {m.date}
                                    </td>
                                    <td className="p-2.5 font-bold text-slate-900">{m.action}</td>
                                    <td className="p-2.5 text-slate-700">{m.office}</td>
                                    <td className="p-2.5 text-slate-600 leading-relaxed">{m.remarks}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold flex items-center space-x-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Status</span>
                          </button>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => setShowReminderModal(true)}
                              className="px-3.5 py-1.5 border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded text-xs font-semibold flex items-center space-x-1"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Send Reminder</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCpgramsView('lodge_public')}
                              className="px-4 py-1.5 bg-[#6b0239] hover:bg-[#52002b] text-white rounded text-xs font-bold"
                            >
                              Lodge Another Grievance
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. Official Gray Disclaimer Bar (Matches Screenshot 2) */}
            <div className="bg-[#e9ecef] border-t border-slate-300 py-3 px-4 text-center text-slate-600 text-xs">
              <div className="max-w-7xl mx-auto">
                This site is designed, developed &amp; hosted by <strong>National Informatics Centre</strong>, Ministry of Electronics &amp; IT (MeitY), Government of India and Content owned by <strong>Department of Administrative Reforms &amp; Public Grievances</strong>.
              </div>
            </div>

            {/* 7. Official Dark Blue Footer Bar (Matches Screenshot 2) */}
            <footer className="bg-[#002f5e] text-white border-t border-[#002040]">
              <div className="max-w-7xl mx-auto px-4 py-6 space-y-4 text-xs">
                {/* Resolution & Browser Compatibility */}
                <div className="text-center text-blue-200 text-[11px]">
                  Portal is Compatible with all major Browsers like Google Chrome, Mozilla Firefox, Microsoft Edge, Safari etc. Best Viewed in 1440 x 900 resolution
                </div>

                {/* Partner Badges / Government Initiatives */}
                <div className="flex flex-wrap items-center justify-center gap-6 py-2 border-y border-blue-900/60">
                  <div className="flex items-center space-x-2 text-white/90 font-bold text-xs">
                    <span>🇮🇳 Swachh Bharat</span>
                  </div>
                  <span className="text-white/20">|</span>
                  <div className="flex items-center space-x-2 text-white/90 font-bold text-xs">
                    <span>Digital India 2026</span>
                  </div>
                  <span className="text-white/20">|</span>
                  <div className="flex items-center space-x-2 text-white/90 font-bold text-xs">
                    <span>india.gov.in</span>
                  </div>
                  <span className="text-white/20">|</span>
                  <div className="flex items-center space-x-2 text-white/90 font-bold text-xs">
                    <span>Make In India</span>
                  </div>
                  <span className="text-white/20">|</span>
                  <div className="flex items-center space-x-2 text-white/90 font-bold text-xs">
                    <span>National Informatics Centre (NIC)</span>
                  </div>
                </div>

                {/* Links & Counter */}
                <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-blue-200 gap-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {['Disclaimer', 'Website Policies', 'Web Information Manager'].map((link) => (
                      <a key={link} href="#" onClick={(e) => e.preventDefault()} className="hover:text-white underline">
                        {link}
                      </a>
                    ))}
                  </div>
                  <div className="text-right">
                    <span>Version 7.0.01092019.0.0, Copyright © 2026</span>
                    <span className="mx-1.5">•</span>
                    <span>Last Updated On: 22-10-2026</span>
                    <span className="mx-1.5">•</span>
                    <span>Total Visitors : <strong>8215334</strong> (since 19-01-2024)</span>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        )}

        {/* ============================================================
            AICTE CSS PORTAL VIEW
            ============================================================ */}
        {activePortal === 'css' && (
          <div className="max-w-6xl w-full mx-auto px-4 py-6">
            <div className="bg-white border border-slate-300 rounded shadow-md overflow-hidden">
              {/* CSS Header */}
              <div className="bg-[#0b3b60] text-white border-b-4 border-[#e67e22] p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src="/aicte-emblem.png"
                      alt="AICTE Official Emblem"
                      className="w-12 h-12 object-contain drop-shadow-md shrink-0"
                    />
                    <div>
                      <div className="text-[11px] tracking-wider uppercase text-amber-200 font-semibold">
                        अखिल भारतीय तकनीकी शिक्षा परिषद | All India Council for Technical Education
                      </div>
                      <h2 className="text-base sm:text-xl font-bold tracking-tight">
                        Centralized Support System (CSS) — Grievance Intake Desk
                      </h2>
                      <div className="text-xs text-slate-200">
                        AICTE Direct Digital Channel for Technical Institutions (complaint@aicte-india.org)
                      </div>
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <span className="px-2.5 py-1 bg-white/10 rounded text-[11px] font-mono border border-white/20">
                      PORTAL: aicte-india.org/css
                    </span>
                    <div className="text-[10px] text-amber-200 mt-1">Single-Window CSS Gateway</div>
                  </div>
                </div>
              </div>

              {/* Quick Demo Scenario Bar */}
              <div className="p-4 bg-blue-50/70 border-b border-blue-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-[#0b3b60] uppercase tracking-wide flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-[#e67e22]" />
                    <span>One-Click AICTE CSS Demo Presets:</span>
                  </span>
                  <span className="text-[11px] text-slate-600">
                    Pre-fill realistic complaints to observe real-time reflection on the dashboard
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('delhi_fee')}
                    className="px-3 py-1.5 bg-white border border-blue-300 hover:border-[#0b3b60] hover:bg-blue-100 text-[#0b3b60] rounded text-xs font-semibold transition shadow-2xs"
                  >
                    Delhi Engg College (Triggers RB Overlap!)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('vidyapeeth_faculty')}
                    className="px-3 py-1.5 bg-white border border-blue-300 hover:border-[#0b3b60] hover:bg-blue-100 text-[#0b3b60] rounded text-xs font-semibold transition shadow-2xs"
                  >
                    Vidyapeeth Institute Faculty Dues
                  </button>
                </div>
              </div>

              {/* CSS Form */}
              <form onSubmit={handleIntakeSubmit} className="p-6 space-y-6">
                {/* Institution */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AICTE Technical Institution <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedInstId}
                    onChange={(e) => {
                      setSelectedInstId(e.target.value);
                      const sel = institutions.find((i) => i.id === e.target.value);
                      if (sel) setStateName(sel.state);
                    }}
                    required
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                  >
                    <option value="">-- Choose Technical Institution --</option>
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.institution_name} [{inst.aicte_permanent_id || 'ID Pending'}] — {inst.state}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category & Urgency */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Grievance Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                    >
                      <option value="Fee Cap Violation">Fee Cap Violation &amp; Caution Money</option>
                      <option value="Faculty Deficiency & Non-Payment of Remuneration">Faculty Cadre &amp; Pay Commission</option>
                      <option value="Withholding of Original Certificates">Retention of Original Documents</option>
                      <option value="Infrastructure & Lab Non-Compliance">Infrastructure Deficits</option>
                      <option value="Ragging & Student Harassment">Ragging / Student Welfare</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                    >
                      <option value="Normal">Routine (30 Days)</option>
                      <option value="High">High Urgency (14 Days)</option>
                      <option value="Urgent">Immediate Vigilance (7 Days)</option>
                    </select>
                  </div>
                </div>

                {/* Subject & Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject / Summary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject of grievance..."
                    required
                    className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grievance Facts &amp; Particulars <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed chronological facts..."
                    required
                    className="w-full text-xs border border-slate-300 rounded p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                  />
                </div>

                {/* Complainant Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Complainant Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={complainantName}
                      onChange={(e) => setComplainantName(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={complainantPhone}
                      onChange={(e) => setComplainantPhone(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={complainantEmail}
                      onChange={(e) => setComplainantEmail(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b3b60]"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-3 border-t border-slate-200 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold rounded shadow-sm flex items-center space-x-2 transition"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting to CSS...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-amber-300" />
                        <span>Submit Grievance to AICTE CSS &rarr;</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================
            LIVE INGESTED FEED VIEW
            ============================================================ */}
        {activePortal === 'stream' && (
          <div className="max-w-6xl w-full mx-auto px-4 py-6">
            <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-purple-600 animate-pulse" />
                    <span>External Channel Ingested Feed (CPGRAMS &amp; CSS &rarr; AICTE Registry)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live log of grievances received via external portals and reflected across AICTE Bureaus.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setStreamHistory(getExternalStreamHistory())}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-white text-slate-700 rounded text-xs flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Feed</span>
                  </button>
                </div>
              </div>

              {streamHistory.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No external complaints logged in this session yet.</p>
                  <p className="mt-1">
                    Switch to the{' '}
                    <button
                      onClick={() => {
                        setActivePortal('cpgrams');
                        setCpgramsView('lodge_public');
                      }}
                      className="text-[#0b3b60] underline font-bold"
                    >
                      CPGRAMS Tab
                    </button>{' '}
                    or{' '}
                    <button onClick={() => setActivePortal('css')} className="text-[#0b3b60] underline font-bold">
                      AICTE CSS Tab
                    </button>{' '}
                    to submit a sample grievance!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-3">Source Portal</th>
                        <th className="p-3">External Ref ID</th>
                        <th className="p-3">AICTE Internal Case</th>
                        <th className="p-3">Institution Name</th>
                        <th className="p-3">Violation Category</th>
                        <th className="p-3">Assigned Cell</th>
                        <th className="p-3">Ingested At</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {streamHistory.map((item) => (
                        <tr key={item.externalReferenceId} className="hover:bg-slate-50 transition">
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                item.source === 'CPGRAMS'
                                  ? 'bg-orange-100 text-orange-900 border border-orange-200'
                                  : 'bg-blue-100 text-blue-900 border border-blue-200'
                              }`}
                            >
                              {item.source}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {item.externalReferenceId}
                          </td>
                          <td className="p-3 font-mono font-bold text-[#0b3b60]">
                            {item.internalComplaintNumber}
                          </td>
                          <td className="p-3 font-semibold text-slate-800 max-w-xs truncate">
                            {item.institutionName}
                          </td>
                          <td className="p-3 text-slate-600">{item.category}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-[10px] text-slate-700">
                              {item.assignedCell}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">
                            {new Date(item.submittedAt).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setStatusRegNo(item.externalReferenceId);
                                setStatusCaptchaInput(generatedCaptcha);
                                setActivePortal('cpgrams');
                                setCpgramsView('status');
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[11px] font-semibold"
                            >
                              Track
                            </button>
                            {onNavigateToCase && (
                              <button
                                type="button"
                                onClick={() => onNavigateToCase(item.id)}
                                className="px-2.5 py-1 bg-[#0b3b60] hover:bg-[#072a45] text-white rounded text-[11px] font-semibold"
                              >
                                View Dossier
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer for non-CPGRAMS views */}
      {activePortal !== 'cpgrams' && (
        <footer className="bg-slate-900 text-slate-400 text-xs py-4 border-t border-slate-800 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left space-y-2 sm:space-y-0">
            <div>
              AICTE Cross-Bureau Complaint Coordination Platform • SIH-26264
            </div>
            <div className="text-slate-500">
              CPGRAMS (DARPG) • Centralized Support System (CSS) • Public Grievance Redressal Cell (PGRC)
            </div>
          </div>
        </footer>
      )}

      {/* ============================================================
          INTERACTIVE MODALS & DIALOGS
          ============================================================ */}

      {/* 1. Sign In / Register Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">CPGRAMS Citizen Portal — Sign In</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSignInModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Number / Email / Username
                </label>
                <input
                  type="text"
                  defaultValue="rahul.sharma@gmail.com"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  defaultValue="••••••••••••"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900"
                />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center space-x-1 text-slate-600">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" />
                  <span>Remember me</span>
                </label>
                <a href="#" onClick={(e) => e.preventDefault()} className="text-[#6b0239] hover:underline font-semibold">
                  Forgot Password?
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  alert('Signed in successfully as citizen Rahul M. Sharma.');
                  setShowSignInModal(false);
                }}
                className="w-full py-2.5 bg-[#f2a900] hover:bg-[#dba100] text-slate-900 font-bold rounded shadow-xs"
              >
                Login to Portal
              </button>
              <div className="text-center text-[11px] text-slate-500 border-t border-slate-200 pt-3">
                New Citizen?{' '}
                <button
                  type="button"
                  onClick={() => {
                    alert('Registration: Provide Name, Mobile, Email, and Address to create a digital citizen ID.');
                  }}
                  className="text-[#6b0239] font-bold underline"
                >
                  Click here to Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Redress Process Flow Modal */}
      {showRedressFlowModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Official CPGRAMS Redressal Flow</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRedressFlowModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed">
                As per Department of Administrative Reforms &amp; Public Grievances (DARPG) standards, grievances follow a strict 5-stage computerized lifecycle:
              </p>
              <div className="space-y-3">
                {[
                  {
                    step: 'Stage 1: Citizen Registration',
                    desc: 'Citizen lodges complaint online with supporting documents. Unique registration ID (e.g. DARPG/E/2026/...) generated and acknowledged via SMS/Email.',
                    sla: 'Immediate',
                  },
                  {
                    step: 'Stage 2: Scrutiny & Nodal Forwarding',
                    desc: 'DARPG gateway assigns grievance to the administrative Ministry/Department (e.g. Ministry of Education -> AICTE PGRC).',
                    sla: 'Within 24 Hours',
                  },
                  {
                    step: 'Stage 3: Fact-Finding & Investigation',
                    desc: 'AICTE Nodal Officer scrutinizes complaints, issues notice for explanation to the institution head, and gathers official records.',
                    sla: '7–14 Days',
                  },
                  {
                    step: 'Stage 4: Redressal & Action Taken Report (ATR)',
                    desc: 'Substantive response provided to citizen. Compliance verified with AICTE Approval Process Handbook (APH) regulations.',
                    sla: 'Max 21 Days',
                  },
                  {
                    step: 'Stage 5: Citizen Feedback & Right of Appeal',
                    desc: 'Citizen rates resolution. If rated "Poor", a one-click first appeal is unlocked to the Appellate Authority within 30 days.',
                    sla: '30 Days Window',
                  },
                ].map((s, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded flex items-start space-x-3">
                    <div className="w-6 h-6 rounded-full bg-[#6b0239] text-white font-bold flex items-center justify-center shrink-0 text-xs">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900">{s.step}</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded">
                          {s.sla}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowRedressFlowModal(false)}
                  className="px-4 py-2 bg-[#6b0239] text-white rounded font-bold text-xs"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Citizen Charter Modal */}
      {showCitizenCharterModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#002f5e] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Citizen Charter (नागरिक चार्टर)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCitizenCharterModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <h4 className="font-bold text-[#002f5e] text-sm">Guiding Principles of Citizen Redressal:</h4>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong>Maximum SLA:</strong> Grievance redressal shall be completed within a maximum timeframe of <strong>21 days</strong>.</li>
                <li><strong>Interim Reply:</strong> If redressal requires technical committee scrutiny, an interim reply with tentative date must be posted.</li>
                <li><strong>No Fee:</strong> Centralized Public Grievance filing is completely free of charge to all citizens.</li>
                <li><strong>Reasoned Decision:</strong> Grievances cannot be closed with vague remarks; a clear, reasoned Action Taken Report (ATR) is mandatory.</li>
              </ul>
              <div className="pt-3 border-t border-slate-200 text-right">
                <button
                  type="button"
                  onClick={() => setShowCitizenCharterModal(false)}
                  className="px-4 py-2 bg-[#002f5e] text-white rounded font-bold text-xs"
                >
                  Close Charter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Nodal Officers Modal */}
      {showNodalOfficersModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-3xl w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">
                  Directory of Nodal Public Grievance Officers ({showNodalOfficersModal === 'central' ? 'Central Government' : 'State Government'})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNodalOfficersModal(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="border border-slate-200 rounded overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">Ministry / Organisation</th>
                      <th className="p-2.5">Nodal PG Officer</th>
                      <th className="p-2.5">Designation</th>
                      <th className="p-2.5">Contact / Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {showNodalOfficersModal === 'central' ? (
                      <>
                        <tr className="bg-orange-50/50">
                          <td className="p-2.5 font-bold text-[#002f5e]">AICTE (Technical Education)</td>
                          <td className="p-2.5 font-bold">Shri R.K. Soni</td>
                          <td className="p-2.5">Director (PGRC)</td>
                          <td className="p-2.5 font-mono text-[11px]">011-29581000 / pgrc@aicte-india.org</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold">Ministry of Education (Higher Ed)</td>
                          <td className="p-2.5">Smt. Neeta Prasad</td>
                          <td className="p-2.5">Joint Secretary</td>
                          <td className="p-2.5 font-mono text-[11px]">011-23381097 / neeta.prasad@nic.in</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold">DARPG Central Gateway</td>
                          <td className="p-2.5">Shri NBS Rajput</td>
                          <td className="p-2.5">Joint Secretary (PG)</td>
                          <td className="p-2.5 font-mono text-[11px]">011-20984120 / helpdesk-pgportal@gov.in</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold">UGC (University Grants Commission)</td>
                          <td className="p-2.5">Prof. Rajnish Jain</td>
                          <td className="p-2.5">Secretary</td>
                          <td className="p-2.5 font-mono text-[11px]">011-23236288 / secy.ugc@nic.in</td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <td className="p-2.5 font-semibold">Delhi (Dept of Training &amp; Technical Ed)</td>
                          <td className="p-2.5">Shri K.S. Yadav</td>
                          <td className="p-2.5">Additional Director</td>
                          <td className="p-2.5 font-mono text-[11px]">011-27321024 / tte.delhi@gov.in</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold">Maharashtra (Directorate of Technical Ed)</td>
                          <td className="p-2.5">Dr. Abhay Wagh</td>
                          <td className="p-2.5">Director DTE</td>
                          <td className="p-2.5 font-mono text-[11px]">022-22641150 / dte.mumbai@gov.in</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-semibold">Karnataka (Dept of Technical Education)</td>
                          <td className="p-2.5">Smt. Pushpa G.</td>
                          <td className="p-2.5">Joint Director</td>
                          <td className="p-2.5 font-mono text-[11px]">080-22262243 / dte.kar@gov.in</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowNodalOfficersModal(null)}
                  className="px-4 py-2 bg-[#6b0239] text-white rounded font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Nodal Authority for Appeal Modal */}
      {showNodalAuthorityAppealModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#002f5e] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Appellate Authority for Public Grievances</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNodalAuthorityAppealModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p className="leading-relaxed">
                If you are dissatisfied with the final Action Taken Report (ATR) furnished by the Grievance Officer, you have the statutory right to file a First Appeal within <strong>30 days of closure</strong>.
              </p>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="font-bold text-[#002f5e]">AICTE First Appellate Authority:</div>
                <div className="font-semibold text-slate-900 mt-1">Member Secretary, AICTE</div>
                <div className="text-[11px] text-slate-600">Nelson Mandela Marg, Vasant Kunj, New Delhi – 110070</div>
                <div className="text-[11px] font-mono mt-1 text-blue-900">Email: ms@aicte-india.org | Tel: 011-29581002</div>
              </div>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowNodalAuthorityAppealModal(false)}
                  className="px-4 py-2 bg-[#002f5e] text-white rounded font-bold text-xs"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Mobile App Modal */}
      {showMobileAppModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">CPGRAMS Mobile App on Google Play &amp; UMANG</h3>
              <button
                type="button"
                onClick={() => setShowMobileAppModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700 text-center">
              <div className="text-4xl">📱</div>
              <h4 className="font-bold text-slate-900 text-sm">Lodge &amp; Track on the Go</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                CPGRAMS is available as a native Android application on Google Play Store and as an integrated service on UMANG (Unified Mobile Application for New-age Governance).
              </p>
              <div className="p-3 bg-slate-100 rounded text-slate-800 font-mono text-[11px]">
                Search keyword: "CPGRAMS" or "MyGrievance" by NIC GOI
              </div>
              <button
                type="button"
                onClick={() => setShowMobileAppModal(false)}
                className="w-full py-2 bg-[#6b0239] text-white rounded font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Contact Us Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#002f5e] text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Official CPGRAMS Contact &amp; Help Desk</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                <div className="font-bold text-slate-900 text-sm">National Toll-Free Helpline:</div>
                <div className="text-xl font-black text-[#002f5e] mt-1">1800-425-0012</div>
                <div className="text-[11px] text-slate-600 mt-0.5">Operated by DARPG (9:00 AM – 8:00 PM, Mon–Sat)</div>
              </div>
              <div>
                <strong className="block text-slate-900">Headquarters:</strong>
                <span>Department of Administrative Reforms &amp; Public Grievances (DARPG)</span>
                <span className="block text-slate-500">Public Redress Division, CGO Complex, New Delhi – 110 003</span>
              </div>
              <div>
                <strong className="block text-slate-900">Email Enquiries:</strong>
                <span className="font-mono text-blue-700">helpdesk-pgportal@gov.in / complaints@aicte-portal.in</span>
              </div>
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-[#002f5e] text-white rounded font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Pension Grievance Modal */}
      {showPensionModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">CPENGRAMS — Pension Grievance Desk</h3>
              <button
                type="button"
                onClick={() => setShowPensionModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <p className="leading-relaxed">
                Pension grievances of Central Government civil, defense, postal, and railway pensioners are monitored via the dedicated <strong>CPENGRAMS</strong> platform under Department of Pension &amp; Pensioners' Welfare (DoP&amp;PW).
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
                For technical institute pension matters (AICTE/UGC autonomous bodies), please choose <strong>Lodge Public Grievance</strong> under the Category <em>"Faculty Deficiency &amp; Non-Payment of Remuneration"</em>.
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPensionModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPensionModal(false);
                    setCategory('Faculty Deficiency & Non-Payment of Remuneration');
                    setCpgramsView('lodge_public');
                  }}
                  className="px-4 py-1.5 bg-[#6b0239] text-white rounded font-bold text-xs"
                >
                  Lodge as Institute Matter &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Send Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#6b0239] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Send Grievance Reminder / Clarification</h3>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  placeholder="e.g. DARPG/E/2026/01492"
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reminder Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Please specify additional facts or note that the resolution exceeds the 21-day SLA..."
                  className="w-full border border-slate-300 rounded p-2.5"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Reminder logged successfully. It has been transmitted to the Nodal Grievance Officer at AICTE.');
                    setShowReminderModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#6b0239] text-white rounded font-bold"
                >
                  Transmit Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. Rate Grievance / Appeal Modal */}
      {showAppealModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#002f5e] text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Rate Grievance &amp; Lodge Appeal</h3>
              <button
                type="button"
                onClick={() => setShowAppealModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-700">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Closed Grievance Registration Number</label>
                <input
                  type="text"
                  placeholder="e.g. DARPG/E/2026/01492"
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Citizen Satisfaction Rating</label>
                <select className="w-full border border-slate-300 rounded px-3 py-2">
                  <option value="Poor">Poor (Unsatisfied — Unlocks Appeal)</option>
                  <option value="Fair">Fair</option>
                  <option value="Good">Good</option>
                  <option value="Excellent">Excellent</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Grounds of Appeal</label>
                <textarea
                  rows={3}
                  placeholder="State why the resolution or explanation provided by the institution was unsatisfactory..."
                  className="w-full border border-slate-300 rounded p-2.5"
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAppealModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Appeal docketed with Appellate Authority (Member Secretary, AICTE). Official Appeal Registration ID generated.');
                    setShowAppealModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#002f5e] text-white rounded font-bold"
                >
                  Submit Appeal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
