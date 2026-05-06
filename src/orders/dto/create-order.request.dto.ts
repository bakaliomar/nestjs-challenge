import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, Min } from 'class-validator';

export class CreateOrderRequestDTO {
  @ApiProperty({ description: 'ID of the record to order' })
  @IsMongoId()
  recordId: string;

  @ApiProperty({ description: 'Quantity to order', example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}
