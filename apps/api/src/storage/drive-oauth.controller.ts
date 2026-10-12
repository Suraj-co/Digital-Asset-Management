import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { GoogleWorkspaceService } from './google-workspace.js';

@ApiExcludeController()
@Controller('storage/oauth')
export class DriveOauthController {
  constructor(private readonly google: GoogleWorkspaceService) {}

  @Get('start')
  start(@Res() res: Response): void {
    const url = this.google.authorizationUrl();
    if (!url) {
      res
        .status(400)
        .type('html')
        .send(
          '<p>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, restart the API, then open this page again.</p>',
        );
      return;
    }
    res.redirect(url);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.type('html');
    if (error || !code || !state) {
      res.status(400).send('<p>Google did not finish the connection. Open the connect page and try again.</p>');
      return;
    }
    try {
      await this.google.connect(code, state);
      res
        .status(200)
        .send(
          '<p>Google Drive and the history sheet are connected. New folders and files will be stored in Drive, and changes will be added to the history sheet.</p>',
        );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Google did not connect.';
      res.status(400).send(`<p>${escapeHtml(message)}</p>`);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
