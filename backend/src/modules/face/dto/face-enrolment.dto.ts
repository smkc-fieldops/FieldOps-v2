import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Base64 characters allowed: the same ceiling as a punch's crop, under the API's 100 kB body limit. */
export const MAX_ENROL_IMAGE_BASE64 = 96_000;

export class CreateFaceEnrolmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffId: string;

  @ApiProperty({ description: `Base64 JPEG of the person's face (≤ ${MAX_ENROL_IMAGE_BASE64} chars); never stored` })
  @IsString()
  @MinLength(100)
  @MaxLength(MAX_ENROL_IMAGE_BASE64)
  imageBase64: string;
}

export class FaceEnrolmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) staffId: string;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}

export class FaceEnrolmentListDto {
  @ApiProperty({ type: [FaceEnrolmentDto] }) items: FaceEnrolmentDto[];
  @ApiProperty({ description: 'How many more photos can be added', example: 4 }) remaining: number;
}
