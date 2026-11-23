import { describe, expect, it } from 'vitest';
import { guessColumns } from '../src/columns';

describe('guessColumns', () => {
  it.each([
    ['Phone', 'phone', 'high'],
    ['Phone Number', 'phone', 'high'],
    ['Cell Phone', 'phone', 'high'],
    ['Mobile #', 'phone', 'high'],
    ['can2_phone', 'phone', 'high'],
    ['VAN Mobile', 'phone', 'high'],
    ['Action Network Phone', 'phone', 'high'],
    ['Mailchimp Mobile Phone', 'phone', 'high'],
    ['Solidarity Tech Telephone', 'phone', 'high'],
    ['Email', 'email', 'high'],
    ['E-mail', 'email', 'high'],
    ['Email Address', 'email', 'high'],
    ['can2_email', 'email', 'high'],
    ['VAN email', 'email', 'high'],
    ['opt_out', 'optOut', 'high'],
    ['sms_opt_out', 'optOut', 'high'],
    ['Text Opt-Out', 'optOut', 'high'],
    ['Do Not Text', 'optOut', 'high'],
    ['Do Not Contact', 'optOut', 'high'],
    ['van_sms_opt_out', 'optOut', 'high'],
    ['action_network_text_opt_out', 'optOut', 'high'],
    ['solidarity_tech_do_not_text', 'optOut', 'high'],
    ['unsubscribe', 'optOut', 'high'],
    ['can2_sms_status', 'optOut', 'high'],
    ['mailchimp_sms_status', 'optOut', 'high'],
    ['Subscription Status', 'optOut', 'high'],
    ['First_Name', 'firstName', 'high'],
    ['Given Name', 'firstName', 'high'],
    ['VAN First Name', 'firstName', 'high'],
    ['Last_Name', 'lastName', 'high'],
    ['Family Name', 'lastName', 'high'],
    ['Action Network Surname', 'lastName', 'high'],
  ] as const)(
    'recognizes %s as a %s header',
    (header, role, confidence) => {
      const columns = guessColumns([header]);

      expect(columns[role]).toBe(header);
      if (role === 'optOut') {
        expect(columns.optOutConfidence).toBe(confidence);
        expect(columns.optOutMode).toBe(header.toLowerCase().includes('status') ? 'status' : 'flag');
      }
    },
  );

  it('suggests a low-confidence opt-out header for confirmation', () => {
    const columns = guessColumns(['phone', 'email', 'custom_opt_out_field']);

    expect(columns.optOut).toBe('custom_opt_out_field');
    expect(columns.optOutMode).toBe('flag');
    expect(columns.optOutConfidence).toBe('suggested');
  });

  it('uses alias priority when more than one phone header matches', () => {
    expect(guessColumns(['Mobile', 'Phone']).phone).toBe('Phone');
  });

  it('returns null when no phone or opt-out-like header is found', () => {
    const columns = guessColumns(['Email Address', 'contact notes']);

    expect(columns.phone).toBeNull();
    expect(columns.optOut).toBeNull();
    expect(columns.optOutMode).toBeNull();
    expect(columns.optOutConfidence).toBe('none');
  });
});
