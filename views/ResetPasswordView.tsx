import React, { useEffect, useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { supabase } from '../services/supabase';
import { Lock, AlertOctagon, CheckCircle } from 'lucide-react';

export const ResetPasswordView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError('Unable to validate reset link. Please request a new one.');
        setIsReady(true);
        setHasSession(false);
        return;
      }
      const session = data?.session;
      setHasSession(!!session);
      setIsReady(true);
      if (!session) {
        setError('Reset link is invalid or expired. Please request a new one.');
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, []);

  const handleUpdate = async () => {
    setError('');
    setInfo('');
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setIsSaving(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setInfo('Password updated. You can log in now.');
      setPassword('');
      setConfirm('');
    } catch (e: any) {
      setError(e?.message || 'Password reset failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 animate-fade-in pb-safe justify-center max-w-sm mx-auto w-full">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-700 border border-brand-200">
          <Lock size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
        <p className="text-slate-600 font-medium">Set a new password for your account.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <Input
          disabled={!isReady || !hasSession || isSaving}
          label="New Password"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-slate-300"
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="border-slate-300"
        />

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertOctagon size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        <Button
          fullWidth
          size="lg"
          onClick={handleUpdate}
          className="font-bold shadow-md"
          disabled={!isReady || isSaving}
        >
          {isSaving ? 'Saving…' : 'Update Password'}
        </Button>

        <Button
          fullWidth
          variant="outline"
          onClick={() => setView('LOGIN')}
          className="border-slate-300 text-slate-900 font-bold"
        >
          Back to Login
        </Button>
      </div>
    </div>
  );
};
