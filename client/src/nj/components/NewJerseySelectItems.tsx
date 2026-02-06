/* eslint-disable i18next/no-literal-string */
/* ^ We're not worried about i18n for this app ^ */

import { DropdownMenuSeparator } from '@librechat/client';
import * as Select from '@ariakit/react/select';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, GraduationCap, Mail } from 'lucide-react';

/**
 * New Jersey-specific menu items that show up in the AccountSettings popup.
 */
export function NewJerseySelectItems() {
  const navigate = useNavigate();

  return (
    <>
      <Select.SelectItem
        value=""
        onClick={() => navigate('nj/guide')}
        className="select-item text-sm"
      >
        <GraduationCap className="icon-md" aria-hidden="true" />
        Guides & FAQs
      </Select.SelectItem>

      <Select.SelectItem
        value=""
        onClick={() => navigate('nj/about')}
        className="select-item text-sm"
      >
        <BookOpen className="icon-md" aria-hidden="true" />
        About the AI Assistant
      </Select.SelectItem>

      <DropdownMenuSeparator />

      <Select.SelectItem
        value=""
        onClick={() => window.open('https://forms.office.com/g/zLiSuXxJ0Y', '_blank')}
        className="select-item text-sm"
      >
        <Mail className="icon-md" aria-hidden="true" />
        Contact us
      </Select.SelectItem>

      <Select.SelectItem
        value=""
        onClick={() =>
          window.open('https://public.govdelivery.com/accounts/NJGOV/signup/45878', '_blank')
        }
        className="select-item text-sm"
      >
        <Bell className="icon-md" aria-hidden="true" />
        Get updates
      </Select.SelectItem>

      <DropdownMenuSeparator />
    </>
  );
}
