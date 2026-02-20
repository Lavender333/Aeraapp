
import React, { useState } from 'react';
import { HouseholdMember } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { calculateAgeFromDob, deriveAgeGroupFromDob, isValidDobFormat, isValidPhoneForInvite, normalizePhoneDigits } from '../services/validation';
import { Plus, User, Trash2, Edit2, X, Save } from 'lucide-react';

interface HouseholdManagerProps {
  members: HouseholdMember[];
  onChange: (members: HouseholdMember[]) => void;
  readOnly?: boolean;
  latestSafetyStatusByMember?: Record<string, { status: 'SAFE' | 'DANGER'; at?: string }>;
}

export const HouseholdManager: React.FC<HouseholdManagerProps> = ({ members, onChange, readOnly = false, latestSafetyStatusByMember = {} }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<HouseholdMember>({
    id: '',
    name: '',
    age: '',
    needs: '',
    mobilityFlag: false,
    medicalFlag: false,
    loginEnabled: false,
    loginPhone: '',
  });

  const formatInvitePhone = (value: string) => {
    const digits = normalizePhoneDigits(value).slice(0, 15);
    if (digits.length <= 10) {
      if (digits.length < 4) return digits;
      if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return `+${digits}`;
  };

  const startAdd = () => {
    setCurrentMember({ id: Date.now().toString(), name: '', age: '', needs: '', mobilityFlag: false, medicalFlag: false, loginEnabled: false, loginPhone: '' });
    setFormError(null);
    setIsEditing(true);
  };

  const startEdit = (member: HouseholdMember) => {
    setCurrentMember({
      ...member,
      mobilityFlag: Boolean(member.mobilityFlag),
      medicalFlag: Boolean(member.medicalFlag),
      loginEnabled: Boolean(member.loginEnabled),
      loginPhone: member.loginPhone || '',
    });
    setFormError(null);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Remove this member?')) {
      onChange(members.filter(m => m.id !== id));
    }
  };

  const handleSave = () => {
    const trimmedName = currentMember.name.trim();
    const dob = String(currentMember.age || '').trim();

    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }
    if (!isValidDobFormat(dob) || calculateAgeFromDob(dob) === null) {
      setFormError('Date of birth is required in MM/DD/YYYY format.');
      return;
    }
    if (currentMember.loginEnabled && !isValidPhoneForInvite(currentMember.loginPhone || '')) {
      setFormError('A valid member phone is required to enable account invites.');
      return;
    }

    const derivedAgeGroup = deriveAgeGroupFromDob(dob);
    const autoMobilityFlag = ['INFANT', 'CHILD', 'SENIOR'].includes(derivedAgeGroup);

    const preparedMember: HouseholdMember = {
      ...currentMember,
      name: trimmedName,
      age: dob,
      ageGroup: derivedAgeGroup,
      mobilityFlag: Boolean(currentMember.mobilityFlag) || autoMobilityFlag,
      medicalFlag: Boolean(currentMember.medicalFlag),
      loginPhone: currentMember.loginEnabled ? formatInvitePhone(currentMember.loginPhone || '') : '',
    };

    const existingIndex = members.findIndex(m => m.id === currentMember.id);
    let newMembers = [...members];

    if (existingIndex >= 0) {
      newMembers[existingIndex] = preparedMember;
    } else {
      newMembers.push(preparedMember);
    }

    onChange(newMembers);
    setFormError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-fade-in">
        <h4 className="font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span>{members.some(m => m.id === currentMember.id) ? 'Edit Member' : 'Add Family Member'}</span>
          <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </h4>
        
        <div className="space-y-3">
          <Input 
            label="Name" 
            placeholder="e.g. Sarah Jones" 
            value={currentMember.name} 
            onChange={e => setCurrentMember({...currentMember, name: e.target.value})}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input 
              label="Date of Birth" 
              placeholder="MM/DD/YYYY" 
              value={currentMember.age} 
              onChange={e => setCurrentMember({...currentMember, age: e.target.value})}
              error={currentMember.age && (!isValidDobFormat(currentMember.age) || calculateAgeFromDob(currentMember.age) === null)
                ? 'Use MM/DD/YYYY'
                : undefined}
            />
            <Input 
              label="Medical/Needs" 
              placeholder="Optional" 
              value={currentMember.needs} 
              onChange={e => setCurrentMember({...currentMember, needs: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobility Flag</label>
              <select
                value={String(Boolean(currentMember.mobilityFlag))}
                onChange={(e) =>
                  setCurrentMember({
                    ...currentMember,
                    mobilityFlag: e.target.value === 'true',
                  })
                }
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Medical Flag</label>
              <select
                value={String(Boolean(currentMember.medicalFlag))}
                onChange={(e) =>
                  setCurrentMember({
                    ...currentMember,
                    medicalFlag: e.target.value === 'true',
                  })
                }
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-slate-900"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span className="text-sm font-medium text-slate-700">Allow account invite (optional)</span>
            <input
              type="checkbox"
              checked={Boolean(currentMember.loginEnabled)}
              onChange={(e) => setCurrentMember({ ...currentMember, loginEnabled: e.target.checked })}
            />
          </label>
          <p className="text-xs text-slate-500 -mt-1">This does not create an account. It only enables invite-code access for this person.</p>
          {currentMember.loginEnabled && (
            <Input
              label="Member Mobile Phone *"
              placeholder="(555) 123-4567"
              value={currentMember.loginPhone || ''}
              onChange={e => setCurrentMember({ ...currentMember, loginPhone: formatInvitePhone(e.target.value) })}
              error={currentMember.loginPhone && !isValidPhoneForInvite(currentMember.loginPhone) ? 'Enter a valid phone number' : undefined}
            />
          )}
          {formError && <p className="text-xs text-red-600 font-semibold">{formError}</p>}
          
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => { setIsEditing(false); setFormError(null); }}>Cancel</Button>
            <Button fullWidth onClick={handleSave}>
              <Save size={16} className="mr-2" /> Save Member
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.length > 0 ? (
        <div className="grid gap-2">
          {members.map(member => (
            <div key={member.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 leading-tight">{member.name}</p>
                  <p className="text-xs text-slate-500">
                    DOB: {member.age || 'N/A'}
                    {typeof member.mobilityFlag === 'boolean' && ` • Mobility: ${member.mobilityFlag ? 'Yes' : 'No'}`}
                    {typeof member.medicalFlag === 'boolean' && ` • Medical: ${member.medicalFlag ? 'Yes' : 'No'}`}
                    {` • Account Invite: ${member.loginEnabled ? 'Enabled' : 'Not enabled'}`}
                    {member.loginEnabled && member.loginPhone && ` • ${member.loginPhone}`}
                    {member.needs && ` • ${member.needs}`}
                  </p>
                  {latestSafetyStatusByMember[member.id] && (
                    <p className={`text-[11px] mt-0.5 font-semibold ${latestSafetyStatusByMember[member.id].status === 'DANGER' ? 'text-red-700' : 'text-emerald-700'}`}>
                      Latest safety status: {latestSafetyStatusByMember[member.id].status}
                      {latestSafetyStatusByMember[member.id].at
                        ? ` • ${new Date(latestSafetyStatusByMember[member.id].at as string).toLocaleString()}`
                        : ''}
                    </p>
                  )}
                </div>
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEdit(member)} 
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(member.id)} 
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
          No household members added yet.
        </div>
      )}
      {!readOnly && (
        <Button variant="outline" fullWidth onClick={startAdd} className="border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600">
          <Plus size={18} className="mr-2" /> Add Member
        </Button>
      )}
    </div>
  );
};
