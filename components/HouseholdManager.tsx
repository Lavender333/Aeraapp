
import React, { useState } from 'react';
import { HouseholdMember } from '../types';
import { Button } from './Button';
import { Input } from './Input';
import { Plus, User, Trash2, Edit2, X, Save } from 'lucide-react';

interface HouseholdManagerProps {
  members: HouseholdMember[];
  onChange: (members: HouseholdMember[]) => void;
}

export const HouseholdManager: React.FC<HouseholdManagerProps> = ({ members, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentMember, setCurrentMember] = useState<HouseholdMember>({
    id: '',
    name: '',
    age: '',
    needs: ''
  });

  const startAdd = () => {
    setCurrentMember({ id: Date.now().toString(), name: '', age: '', needs: '' });
    setIsEditing(true);
  };

  const startEdit = (member: HouseholdMember) => {
    setCurrentMember(member);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Remove this member?')) {
      onChange(members.filter(m => m.id !== id));
    }
  };

  const handleSave = () => {
    if (!currentMember.name) return;

    const existingIndex = members.findIndex(m => m.id === currentMember.id);
    let newMembers = [...members];

    if (existingIndex >= 0) {
      newMembers[existingIndex] = currentMember;
    } else {
      newMembers.push(currentMember);
    }

    onChange(newMembers);
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
              label="Age" 
              placeholder="e.g. 5 or 3 months" 
              value={currentMember.age} 
              onChange={e => setCurrentMember({...currentMember, age: e.target.value})}
            />
            <Input 
              label="Medical/Needs" 
              placeholder="Optional" 
              value={currentMember.needs} 
              onChange={e => setCurrentMember({...currentMember, needs: e.target.value})}
            />
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" fullWidth onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button fullWidth onClick={handleSave} disabled={!currentMember.name}>
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
                  <p className="text-xs text-slate-500">Age: {member.age || 'N/A'} {member.needs && `• ${member.needs}`}</p>
                </div>
              </div>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
          No household members added yet.
        </div>
      )}

      <Button variant="outline" fullWidth onClick={startAdd} className="border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-600">
        <Plus size={18} className="mr-2" /> Add Member
      </Button>
    </div>
  );
};
