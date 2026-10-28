import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import type { InviteBatch } from '@/features/members/api';
import { useImportMembers, useSendImportInvites } from '@/features/members/hooks';
import {
  importTemplate,
  isSpreadsheetFile,
  joinMessage,
  MAX_IMPORT_ROWS,
  previewImport,
  type ImportPreview,
} from '@/features/members/import-rules';
import type { ImportOutcome } from '@/features/members/types';
import { usePlans } from '@/features/memberships/hooks';
import { shareCsv } from '@/features/reports/share';

/** Rows with problems listed before the owner has to fix the file; the rest are counted. */
const PROBLEMS_SHOWN = 15;

/**
 * Brings a gym's members over from a spreadsheet: share the template, pick the
 * filled CSV, check the preview, import, then email the invites. Owners only.
 */
export default function ImportMembersScreen() {
  const gym = useActiveGym();
  const plans = usePlans(gym.gymId);
  const importer = useImportMembers(gym.gymId);
  const inviter = useSendImportInvites(gym.gymId);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [invites, setInvites] = useState<InviteBatch | null>(null);

  const planList = plans.data ?? [];
  const ready = preview?.rows.filter((r) => r.errors.length === 0) ?? [];
  const problems = preview?.rows.filter((r) => r.errors.length > 0) ?? [];
  const toInvite = (outcomes ?? []).filter((o) => o.result !== 'skipped' && !o.joined);

  const shareTemplate = () =>
    shareCsv('corefit-members-template.csv', importTemplate(planList)).catch((e: Error) =>
      setFileError(e.message),
    );

  const pickFile = async () => {
    setFileError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setOutcomes(null);
    setInvites(null);
    importer.reset();
    inviter.reset();
    if (isSpreadsheetFile(asset.name)) {
      setPreview(null);
      setFileName(asset.name);
      setFileError('Save the Excel file as CSV, then pick it again.');
      return;
    }
    try {
      // The web demo gets a blob link, which expo-file-system can't open.
      const text =
        Platform.OS === 'web'
          ? await fetch(asset.uri).then((r) => r.text())
          : await new File(asset.uri).text();
      setFileName(asset.name);
      setPreview(previewImport(text, planList));
    } catch (e) {
      setPreview(null);
      setFileError(`Couldn't read the file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const runImport = () => {
    setProgress(0);
    importer.mutate(
      { rows: ready, onProgress: setProgress },
      { onSuccess: (result) => setOutcomes(result) },
    );
  };

  const runInvites = () => {
    setProgress(0);
    inviter.mutate(
      { emails: toInvite.map((o) => o.email), onProgress: setProgress },
      { onSuccess: setInvites },
    );
  };

  return (
    <Screen refreshable={false}>
      <SectionHeader title="1. Fill in the template" />
      <Card>
        <ThemedText type="small">
          One member per row. Name, email and mobile are required.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {planList.length
            ? `Plans: ${planList.map((p) => p.name).join(', ')}. Dates: 25/10/2026.`
            : 'Add membership plans first.'}
        </ThemedText>
        <Button
          label="Share the template"
          icon="download-outline"
          variant="secondary"
          onPress={shareTemplate}
        />
      </Card>

      <SectionHeader title="2. Pick your file" />
      <Button
        label={fileName ? 'Pick another file' : 'Pick the CSV file'}
        icon="document-outline"
        variant={preview ? 'secondary' : 'primary'}
        disabled={importer.isPending || inviter.isPending}
        onPress={pickFile}
      />
      {fileError ? <ThemedText themeColor="danger">{fileError}</ThemedText> : null}

      {preview && !outcomes ? (
        <PreviewCard
          fileName={fileName}
          preview={preview}
          readyCount={ready.length}
          problems={problems}
        />
      ) : null}

      {preview && !outcomes && ready.length > 0 ? (
        <>
          <SectionHeader title="3. Import" />
          {importer.isPending ? <ProgressBar value={progress / ready.length} /> : null}
          <Button
            label={
              importer.isPending
                ? `Importing ${progress} of ${ready.length}…`
                : `Import ${ready.length} member${ready.length === 1 ? '' : 's'}`
            }
            icon="cloud-upload-outline"
            loading={importer.isPending}
            onPress={runImport}
          />
          {problems.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              Rows with problems are skipped. Fix and import again anytime.
            </ThemedText>
          ) : null}
          {importer.error ? (
            <ThemedText themeColor="danger">{importer.error.message}</ThemedText>
          ) : null}
        </>
      ) : null}

      {outcomes ? <ResultCard outcomes={outcomes} /> : null}

      {outcomes && toInvite.length > 0 ? (
        <>
          <SectionHeader title="4. Tell them to join" />
          <ThemedText type="small" themeColor="textSecondary">
            Share on your gym&apos;s WhatsApp group. Members sign up with the same email.
          </ThemedText>
          <Button
            label="Share join message"
            icon="logo-whatsapp"
            onPress={() => Share.share({ message: joinMessage(gym.gymName) }).catch(() => {})}
          />
          {invites ? null : (
            <>
              {inviter.isPending ? <ProgressBar value={progress / toInvite.length} /> : null}
              <Button
                label={
                  inviter.isPending
                    ? `Sending ${progress} of ${toInvite.length}…`
                    : `Or email ${toInvite.length} invite${toInvite.length === 1 ? '' : 's'}`
                }
                icon="mail-outline"
                variant="secondary"
                loading={inviter.isPending}
                onPress={runInvites}
              />
            </>
          )}
        </>
      ) : null}

      {invites ? <InviteCard batch={invites} /> : null}
    </Screen>
  );
}

function PreviewCard({
  fileName,
  preview,
  readyCount,
  problems,
}: {
  fileName: string | null;
  preview: ImportPreview;
  readyCount: number;
  problems: ImportPreview['rows'];
}) {
  if (preview.missingColumns.length) {
    return (
      <Card>
        <ThemedText type="smallBold">{fileName}</ThemedText>
        <ThemedText themeColor="danger">
          Missing columns: {preview.missingColumns.join(', ')}. Use the template.
        </ThemedText>
      </Card>
    );
  }
  return (
    <Card>
      <ThemedText type="smallBold">{fileName}</ThemedText>
      <ThemedText>
        {readyCount} ready to import
        {problems.length ? `, ${problems.length} with problems` : ''}.
      </ThemedText>
      {preview.examplesSkipped ? (
        <ThemedText type="small" themeColor="textSecondary">
          Example row skipped.
        </ThemedText>
      ) : null}
      {preview.truncated ? (
        <ThemedText type="small" themeColor="danger">
          Only the first {MAX_IMPORT_ROWS} rows are read.
        </ThemedText>
      ) : null}
      {problems.slice(0, PROBLEMS_SHOWN).map((row) => (
        <View key={row.line} style={styles.problem}>
          <ThemedText type="smallBold">
            Row {row.line}
            {row.name ? ` · ${row.name}` : ''}
          </ThemedText>
          {row.errors.map((error) => (
            <ThemedText key={error} type="small" themeColor="danger">
              {error}
            </ThemedText>
          ))}
        </View>
      ))}
      {problems.length > PROBLEMS_SHOWN ? (
        <ThemedText type="small" themeColor="textSecondary">
          And {problems.length - PROBLEMS_SHOWN} more rows with problems.
        </ThemedText>
      ) : null}
    </Card>
  );
}

function ResultCard({ outcomes }: { outcomes: ImportOutcome[] }) {
  const added = outcomes.filter((o) => o.result === 'added').length;
  const updated = outcomes.filter((o) => o.result === 'updated').length;
  const skipped = outcomes.filter((o) => o.result === 'skipped');
  return (
    <Card>
      <ThemedText type="heading">Imported</ThemedText>
      <ThemedText>
        {added} new member{added === 1 ? '' : 's'} added
        {updated ? `, ${updated} already here updated` : ''}
        {skipped.length ? `, ${skipped.length} skipped` : ''}.
      </ThemedText>
      {skipped.slice(0, PROBLEMS_SHOWN).map((o, i) => (
        <ThemedText key={`${o.email}-${i}`} type="small" themeColor="danger">
          {o.email}: {o.message}
        </ThemedText>
      ))}
    </Card>
  );
}

function InviteCard({ batch }: { batch: InviteBatch }) {
  return (
    <Card>
      <ThemedText type="heading">Invites</ThemedText>
      <ThemedText>
        {batch.sent} sent{batch.failed.length ? `, ${batch.failed.length} didn’t go out` : ''}.
      </ThemedText>
      {batch.stopped ? (
        <ThemedText type="small" themeColor="danger">
          Stopped: email limit reached. Try the rest later.
        </ThemedText>
      ) : null}
      {batch.failed.slice(0, PROBLEMS_SHOWN).map((f) => (
        <ThemedText key={f.email} type="small" themeColor="danger">
          {f.email}: {f.error}
        </ThemedText>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  problem: {
    gap: Spacing.half,
  },
});
