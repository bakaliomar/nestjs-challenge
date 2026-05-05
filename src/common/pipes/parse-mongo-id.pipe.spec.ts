import { BadRequestException } from '@nestjs/common';
import { ParseMongoIdPipe } from './parse-mongo-id.pipe';

describe('ParseMongoIdPipe', () => {
  const pipe = new ParseMongoIdPipe();
  const meta = { type: 'param' as const };

  it('passes a valid 24-char hex ObjectId through', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(pipe.transform(id, meta)).toBe(id);
  });

  it('throws BadRequest for a malformed id', () => {
    expect(() => pipe.transform('not-an-id', meta)).toThrow(BadRequestException);
  });

  it('throws BadRequest for an empty string', () => {
    expect(() => pipe.transform('', meta)).toThrow(BadRequestException);
  });
});
