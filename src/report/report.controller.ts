import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Report } from 'src/database/entities/Report';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';

@Controller('reports')
export class ReportController {
  @Post()
  @UseGuards(AuthGuard)
  async report(@CurrentUser() user: User, @Body() body: any) {
    return await Report.create({
      ...body,
      reporter: user.pubKey,
    }).save();
  }
}
