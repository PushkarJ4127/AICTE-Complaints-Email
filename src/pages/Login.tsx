import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Lock, 
  Building2, 
  Scale, 
  ChevronRight, 
  ArrowLeft,
  Loader2,
  FileText
} from 'lucide-react';

interface LoginProps {
  onGoToPublicPortal?: () => void;
}

export const Login: React.FC<LoginProps> = () => {
  const { signIn} = useAuth();
  const [selectedRole, setSelectedRole] = useState<'admin' | 'rb' | 'pgrc' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const predefinedAccounts = [
    {
      role: 'admin' as const,
      title: 'Administrator',
      subtitle: 'Apex National Grievance Monitoring Directorate',
      description: 'System-wide policy enforcement, AI cross-bureau overlap supervision, manual assignment re-allocations, and inter-agency coordination.',
      email: 'superadmin@aicte-india.org',
      icon: Shield,
      accent: 'border-rose-700 hover:border-rose-800 bg-rose-50/30',
      badge: 'bg-rose-100 text-rose-800 border-rose-200'
    },
    {
      role: 'rb' as const,
      title: 'RB Officer',
      subtitle: 'Zonal & State Level Regional Bureau Oversight',
      description: 'Regulatory compliance inspections, university fee ceiling audits, unapproved technical program crackdowns, and statutory inquiries.',
      email: 'rb.officer@aicte-india.org',
      icon: Building2,
      accent: 'border-blue-700 hover:border-blue-800 bg-blue-50/30',
      badge: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      role: 'pgrc' as const,
      title: 'PGRC Officer',
      subtitle: 'Public Grievance Redressal Committee Ombudsperson',
      description: 'Direct citizen grievance hearings, fee refund disputes, harassment tribunals, original certificate withholding complaints, and interim relief directives.',
      email: 'pgrc.ombudsperson@aicte-india.org',
      icon: Scale,
      accent: 'border-emerald-700 hover:border-emerald-800 bg-emerald-50/30',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    }
  ];

  const handleSelectRole = (role: 'admin' | 'rb' | 'pgrc', defaultEmail: string) => {
    setSelectedRole(role);
    setEmail(defaultEmail);
    setPassword('Password@123');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signIn(email, password);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || 'Authentication failed. Please verify credentials against Supabase auth.users.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between font-sans">
      {/* Official Government Color Band */}
      <div className="h-1.5 w-full flex">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        
        {/* Top AICTE Branding Bar */}
        <div className="w-full max-w-xl text-center mb-6">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center p-1.5 shadow-sm border border-slate-200">
              <img 
                src="/aicte-emblem.png" 
                alt="AICTE Official Emblem" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#0b3b60] tracking-wide uppercase mt-0.5">
            Inter-Bureau Complaint Redressal & Oversight Platform
          </p>
          <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-500 mt-1">
            <span>Ministry of Education, Government of India</span>
            <span>•</span>
            <span className="font-mono">SIH 2026 (Problem ID: 26264)</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="w-full max-w-xl bg-white border border-slate-300 rounded shadow-md overflow-hidden">
          
          {/* Header Strip */}
          <div className="bg-[#0b3b60] text-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Authorised Personnel Authentication Gateway
              </span>
            </div>
            <span className="text-[10px] bg-blue-900/80 px-2 py-0.5 rounded border border-blue-400/30 text-blue-200 font-mono">
              SECURE TLS 1.3
            </span>
          </div>

          <div className="p-6 sm:p-8">
            {!selectedRole ? (
              /* Step 1: Select Bureau / Role */
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-700">
                    <User className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Who is trying to login?
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your designated AICTE official role to open your bureau authentication page
                  </p>
                </div>

                <div className="space-y-3">
                  {predefinedAccounts.map((account) => {
                    const IconComp = account.icon;
                    return (
                      <button
                        key={account.role}
                        type="button"
                        onClick={() => handleSelectRole(account.role, account.email)}
                        className={`w-full p-4 border rounded text-left transition flex items-start space-x-4 cursor-pointer hover:shadow-sm ${account.accent}`}
                      >
                        <div className="p-2.5 rounded bg-white shadow-2xs border border-slate-200 text-slate-700 shrink-0 mt-0.5">
                          <IconComp className="w-5 h-5 text-[#0b3b60]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-sm text-slate-900">
                              {account.title}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${account.badge}`}>
                              {account.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium line-clamp-1">
                            {account.subtitle}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {account.description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center ml-2" />
                      </button>
                    );
                  })}
                </div>

                {/* Statutory Regulatory Footer Note */}
                <div className="pt-4 mt-6 border-t border-slate-200 flex items-center space-x-2 text-[11px] text-slate-500 justify-center text-center">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>AICTE Inter-Bureau Case Coordination Platform • Strictly Restricted to Authorized Officials</span>
                </div>
              </div>
            ) : (
              /* Step 2: Role Credentials Login Form */
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  className="inline-flex items-center space-x-1.5 text-xs text-[#0b3b60] hover:text-[#072a45] font-semibold mb-6 group cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Change designated official role</span>
                </button>

                {/* Selected Role Identity Card */}
                {(() => {
                  const roleConfig = predefinedAccounts.find(a => a.role === selectedRole);
                  if (!roleConfig) return null;
                  const RoleIcon = roleConfig.icon;
                  return (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded mb-5 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded border border-slate-200 text-[#0b3b60]">
                          <RoleIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            {roleConfig.title}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {roleConfig.email}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${roleConfig.badge}`}>
                        {roleConfig.role} Desk
                      </span>
                    </div>
                  );
                })()}

                {error && (
                  <div className="p-3.5 mb-5 bg-red-50 border border-red-200 text-xs text-red-800 rounded flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong className="block font-semibold">Authentication Failure</strong>
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Government Email / Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="official@aicte-india.org"
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3b60] focus:border-[#0b3b60] bg-white text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                      Designated Password / Security PIN
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b3b60] focus:border-[#0b3b60] bg-white text-slate-900 font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Default evaluation seed credential: <span className="font-mono font-semibold">Password@123</span>
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 bg-[#0b3b60] hover:bg-[#072a45] text-white text-xs font-bold uppercase tracking-wider rounded shadow-sm transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Authenticating with Central Registry...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 text-amber-400" />
                          <span>Login to AICTE Case Coordination Platform</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Statutory Access Logging:</strong> Login activities and IP signatures are recorded permanently in the AICTE central immutable audit trail for legal vigilance compliance.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ministry Helpline / Technical Support Strip */}
        <div className="w-full max-w-xl text-center text-[11px] text-slate-500 mt-4 space-y-1">
          <div>
            AICTE National Technical Helpdesk: <span className="font-mono text-slate-700">011-29581000</span> (Extn. 26264) • E-Governance Division
          </div>
          <div>
            Nelson Mandela Marg, Vasant Kunj, New Delhi-110070
          </div>
        </div>
      </div>

      {/* Official Government Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-3 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left space-y-1 sm:space-y-0">
          <div>
            © 2026 All India Council for Technical Education (AICTE). All Rights Reserved.
          </div>
          <div className="text-slate-500 text-[11px]">
            Designed for SIH Senior Software Evaluation • Inter-Bureau Cross-Check Engine
          </div>
        </div>
      </footer>
    </div>
  );
};